"""
In-memory network state — the bridge between SQLite and the DSA modules.

What lives in memory (loaded once at startup)
--------------------------------------------
    users         hash table  username -> User          (O(1) lookups)
    graph         SocialGraph adjacency lists            (accepted + pending edges)
    trie          Trie                                  (prefix search index)
    posts         list + hash table id -> Post
    likes         hash table  post_id -> set(usernames) (O(1) "did I like this?")
    comments      hash table  post_id -> chronological list
    requests      hash table  request_id -> ConnectionRequest (the pending queue)
    notifications hash table  username -> FIFO list

Every mutation updates the in-memory structures FIRST, then mirrors the
change into SQLite — so the database is pure persistence while ALL
computation (BFS paths, mutuals, feed ordering, recommendations, search)
happens on these in-memory data structures.

A re-entrant lock guards all operations because the Flask dev server is
multi-threaded.
"""

import re
import threading
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Set, Tuple

import database as db
from config import PASSWORD_MIN, POST_MAX_CHARS
from dsa.bfs import bfs_levels, connection_degrees, shortest_path
from dsa.graph import SocialGraph
from dsa.heap import MinHeap
from dsa.recommendations import people_you_may_know
from dsa.trie import Trie
from errors import ApiError          # re-exported for the route layer
from models import (Comment, ConnectionRequest, Notification, Post, User,
                    hash_password, verify_password)
from models.connection import PENDING
import seed

USERNAME_PATTERN = re.compile(r"^[a-z0-9_]{3,24}$")


def now_iso() -> str:
    """Current UTC time as an ISO-8601 string."""
    return datetime.now(timezone.utc).isoformat()


def ts_of(iso: str) -> float:
    """Parse an ISO timestamp into a Unix float (heap priority key)."""
    try:
        return datetime.fromisoformat(iso).timestamp()
    except (ValueError, TypeError):
        return 0.0


def clean_list(value) -> List[str]:
    """Normalise skills / interests coming from JSON: accepts a list or a
    comma-separated string; deduplicates and trims."""
    if isinstance(value, str):
        parts = value.split(",")
    elif isinstance(value, (list, tuple)):
        parts = [str(item) for item in value]
    else:
        parts = []
    cleaned: List[str] = []
    for part in parts:
        part = part.strip()
        if part and len(part) <= 40 and part not in cleaned:
            cleaned.append(part)
    return cleaned[:12]


class Network:
    """The single in-memory source of truth for the whole platform."""

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self.users: Dict[str, User] = {}
        self.graph = SocialGraph()
        self.trie = Trie()
        self.posts: List[Post] = []
        self.posts_by_id: Dict[int, Post] = {}
        self.likes: Dict[int, Set[str]] = {}
        self.comments: Dict[int, List[Comment]] = {}
        self.comment_likes: Dict[int, Set[str]] = {}
        self.comments_by_id: Dict[int, Comment] = {}
        self.requests: Dict[int, ConnectionRequest] = {}
        self.notifications: Dict[str, List[Notification]] = {}
        self._post_counts: Dict[str, int] = {}
        self._indexed_keywords: Dict[str, List[str]] = {}

    # ====================================================================== #
    # Lifecycle
    # ====================================================================== #
    def initialize(self) -> None:
        """Create tables, seed sample data on first boot, load memory."""
        with self._lock:
            db.init_db()
            if not db.fetch_all_users():
                seed.seed_sample_data()
            self.reload_from_db()

    def reload_from_db(self) -> None:
        """Rebuild every in-memory structure from SQLite. This is the only
        place the database is read in bulk — graph operations afterwards
        never touch SQL."""
        with self._lock:
            self.users = {}
            self.graph = SocialGraph()
            self.trie = Trie()
            self.posts, self.posts_by_id = [], {}
            self.likes, self.comments = {}, {}
            self.comment_likes, self.comments_by_id = {}, {}
            self.requests = {}
            self.notifications = {}
            self._post_counts = {}
            self._indexed_keywords = {}

            for user in db.fetch_all_users():
                self.users[user.username] = user
                self.graph.add_vertex(user.username)
                self._index_user(user)

            for user_a, user_b in db.fetch_connections():
                if user_a in self.users and user_b in self.users \
                        and not self.graph.is_connected(user_a, user_b):
                    self.graph.add_edge(user_a, user_b)

            for request in db.fetch_pending_requests():
                self.requests[request.id] = request
                self.graph.add_pending(request.sender, request.receiver)

            for post in db.fetch_all_posts():
                self.posts.append(post)
                self.posts_by_id[post.id] = post
                self._post_counts[post.author] = self._post_counts.get(post.author, 0) + 1

            self.likes = db.fetch_likes()
            self.comments = db.fetch_comments()
            for comment_list in self.comments.values():
                for comment in comment_list:
                    self.comments_by_id[comment.id] = comment
            self.comment_likes = db.fetch_comment_likes()

            for note in db.fetch_all_notifications():
                self.notifications.setdefault(note.recipient, []).append(note)

    # ---------------------------------------------------------------------- #
    # Trie maintenance
    # ---------------------------------------------------------------------- #
    def _index_user(self, user: User) -> None:
        """Insert a student's searchable keywords (username + name words)
        into the Trie."""
        keywords = [user.username] + user.full_name.split()
        for keyword in keywords:
            self.trie.insert(keyword, user.username)
        self._indexed_keywords[user.username] = keywords

    def _reindex_user(self, user: User) -> None:
        """Remove the old Trie keywords then insert the fresh ones —
        called after a profile edit renames a student."""
        for keyword in self._indexed_keywords.get(user.username, []):
            self.trie.remove(keyword, user.username)
        self._index_user(user)

    # ====================================================================== #
    # Authentication
    # ====================================================================== #
    def register(self, username, password, full_name, programme, year,
                 bio, skills, interests) -> User:
        with self._lock:
            username = (username or "").strip().lower()
            if not USERNAME_PATTERN.match(username):
                raise ApiError(
                    "Username must be 3-24 characters: lowercase letters, "
                    "digits or underscore.", 400)
            # O(1) duplicate check against the users hash table — the
            # UNIQUE constraint in SQLite is the second line of defence.
            if username in self.users:
                raise ApiError("That username is already taken.", 409)
            if not password or len(password) < PASSWORD_MIN:
                raise ApiError(
                    f"Password must be at least {PASSWORD_MIN} characters.", 400)
            full_name = (full_name or "").strip()
            if not full_name or len(full_name) > 60:
                raise ApiError("Please provide your full name.", 400)

            user = User(
                username=username,
                full_name=full_name,
                password_hash=hash_password(password),
                programme=(programme or "").strip()[:60],
                year=(year or "").strip()[:20],
                bio=(bio or "").strip()[:280],
                skills=clean_list(skills),
                interests=clean_list(interests),
                created_at=now_iso(),
            )
            db.insert_user(user)              # persist
            self.users[username] = user       # memory hash table
            self.graph.add_vertex(username)    # new graph vertex
            self._index_user(user)            # searchable in the Trie
            return user

    def login(self, username, password) -> User:
        with self._lock:
            username = (username or "").strip().lower()
            user = self.users.get(username)    # O(1) hash lookup
            if user is None or not verify_password(password or "", user.password_hash):
                raise ApiError("Invalid username or password.", 401)
            return user

    def require_user(self, username: str) -> User:
        user = self.users.get(username)
        if user is None:
            raise ApiError("Student not found.", 404)
        return user

    # ====================================================================== #
    # Profile
    # ====================================================================== #
    def update_profile(self, username, full_name, programme, year, bio,
                       skills, interests) -> User:
        with self._lock:
            user = self.require_user(username)
            full_name = (full_name or "").strip()
            if not full_name or len(full_name) > 60:
                raise ApiError("Full name cannot be empty.", 400)
            user.full_name = full_name
            user.programme = (programme or "").strip()[:60]
            user.year = (year or "").strip()[:20]
            user.bio = (bio or "").strip()[:280]
            user.skills = clean_list(skills)
            user.interests = clean_list(interests)
            db.update_user_profile(username, user.full_name, user.programme,
                                    user.year, user.bio, user.skills,
                                    user.interests)
            self._reindex_user(user)          # keep the Trie fresh
            return user

    def set_profile_photo(self, username: str, avatar_url: str) -> User:
        """Store the URL of an uploaded profile photo ("" clears it)."""
        with self._lock:
            user = self.require_user(username)
            user.avatar_url = avatar_url
            db.update_user_media(username, avatar_url=avatar_url)
            return user

    def set_cover_photo(self, username: str, cover_url: str) -> User:
        """Store the URL of an uploaded profile background ("" clears it)."""
        with self._lock:
            user = self.require_user(username)
            user.cover_url = cover_url
            db.update_user_media(username, cover_url=cover_url)
            return user

    # ====================================================================== #
    # Connection requests (the pending directed edges)
    # ====================================================================== #
    def send_request(self, sender: str, receiver: str) -> ConnectionRequest:
        with self._lock:
            if sender == receiver:
                raise ApiError("You cannot connect with yourself.", 400)
            if receiver not in self.users:
                raise ApiError("Student not found.", 404)
            if self.graph.is_connected(sender, receiver):
                raise ApiError("You are already connected with this student.", 409)
            if self.graph.pending_direction(sender, receiver):
                raise ApiError(
                    "There is already a pending request between you two.", 409)

            created = now_iso()
            request_id = db.insert_request(sender, receiver, created)
            request = ConnectionRequest(request_id, sender, receiver, PENDING, created)
            self.requests[request_id] = request
            self.graph.add_pending(sender, receiver)   # directed edge
            self._notify(receiver, "request_received", sender,
                         f"{self.users[sender].full_name} sent you a "
                         "connection request")
            return request

    def accept_request(self, request_id: int, acting_user: str) -> dict:
        """Accepting converts the directed pending edge into an UNDIRECTED
        connection edge — the core graph transition of the platform."""
        with self._lock:
            request = self._require_pending_request(request_id)
            if request.receiver != acting_user:
                raise ApiError("Only the receiver can accept this request.", 403)
            sender, receiver = request.sender, request.receiver
            if self.graph.is_connected(sender, receiver):
                self._finish_request(request)
                raise ApiError("You are already connected with this student.", 409)

            self.graph.remove_pending(sender, receiver)   # drop directed edge
            self.graph.add_edge(sender, receiver)         # add undirected edge
            db.insert_connection(sender, receiver, now_iso())
            self._finish_request(request)
            self._notify(sender, "request_accepted", receiver,
                         f"{self.users[receiver].full_name} accepted your "
                         "connection request")
            return {"connected_with": sender}

    def reject_request(self, request_id: int, acting_user: str) -> dict:
        with self._lock:
            request = self._require_pending_request(request_id)
            if request.receiver != acting_user:
                raise ApiError("Only the receiver can reject this request.", 403)
            self._finish_request(request)     # rejected -> never an edge
            self._notify(request.sender, "request_rejected", acting_user,
                         f"{self.users[acting_user].full_name} declined "
                         "your connection request")
            return {"rejected": request.sender}

    def cancel_request(self, request_id: int, acting_user: str) -> dict:
        with self._lock:
            request = self._require_pending_request(request_id)
            if request.sender != acting_user:
                raise ApiError("Only the sender can cancel this request.", 403)
            self._finish_request(request)
            return {"cancelled": request.receiver}

    def _require_pending_request(self, request_id) -> ConnectionRequest:
        request = self.requests.get(request_id)
        if request is None or request.status != PENDING:
            raise ApiError("This request no longer exists.", 404)
        return request

    def _finish_request(self, request: ConnectionRequest) -> None:
        """Terminal state: remove the directed edge everywhere (memory + DB)."""
        self.graph.remove_pending(request.sender, request.receiver)
        self.requests.pop(request.id, None)
        db.delete_request(request.id)

    def remove_connection(self, acting_user: str, other: str) -> dict:
        with self._lock:
            if other not in self.users:
                raise ApiError("Student not found.", 404)
            if not self.graph.is_connected(acting_user, other):
                raise ApiError("You are not connected with this student.", 409)
            self.graph.remove_edge(acting_user, other)
            db.delete_connection(acting_user, other)
            return {"removed": other}

    # ====================================================================== #
    # Posts, likes, comments
    # ====================================================================== #
    def create_post(self, author: str, content: str, media_url: str = "",
                    media_type: str = "") -> Post:
        content = (content or "").strip()
        if not content and not media_url:
            raise ApiError("Post content cannot be empty.", 400)
        if len(content) > POST_MAX_CHARS:
            raise ApiError(f"Posts are limited to {POST_MAX_CHARS} characters.", 400)
        with self._lock:
            created = now_iso()
            post = Post(db.insert_post(author, content, created,
                                       media_url, media_type),
                        author, content, created, media_url, media_type)
            self.posts.append(post)
            self.posts_by_id[post.id] = post
            self._post_counts[author] = self._post_counts.get(author, 0) + 1
            return post

    def delete_post(self, post_id: int, acting_user: str) -> dict:
        with self._lock:
            post = self.posts_by_id.get(post_id)
            if post is None:
                raise ApiError("Post not found.", 404)
            if post.author != acting_user:
                raise ApiError("You can only delete your own posts.", 403)
            db.delete_post(post_id)          # cascades likes + comments rows
            self.posts.remove(post)
            self.posts_by_id.pop(post_id, None)
            self.likes.pop(post_id, None)
            for comment in self.comments.pop(post_id, []):
                self.comment_likes.pop(comment.id, None)
                self.comments_by_id.pop(comment.id, None)
            self._post_counts[post.author] = self._post_counts.get(post.author, 1) - 1
            return {"deleted": post_id}

    def toggle_like(self, post_id: int, acting_user: str) -> dict:
        with self._lock:
            post = self.posts_by_id.get(post_id)
            if post is None:
                raise ApiError("Post not found.", 404)
            likers = self.likes.setdefault(post_id, set())
            if acting_user in likers:
                likers.discard(acting_user)
                db.delete_like(post_id, acting_user)
                liked = False
            else:
                likers.add(acting_user)
                db.insert_like(post_id, acting_user, now_iso())
                liked = True
                if post.author != acting_user:
                    self._notify(post.author, "post_liked", acting_user,
                                 f"{self.users[acting_user].full_name} "
                                 "liked your post")
            return {"liked": liked, "likes": len(likers)}

    def add_comment(self, post_id: int, acting_user: str, content: str) -> Comment:
        content = (content or "").strip()
        if not content:
            raise ApiError("Comment cannot be empty.", 400)
        if len(content) > 500:
            raise ApiError("Comments are limited to 500 characters.", 400)
        with self._lock:
            post = self.posts_by_id.get(post_id)
            if post is None:
                raise ApiError("Post not found.", 404)
            created = now_iso()
            comment = Comment(db.insert_comment(post_id, acting_user, content, created),
                              post_id, acting_user, content, created)
            self.comments.setdefault(post_id, []).append(comment)
            self.comments_by_id[comment.id] = comment
            if post.author != acting_user:
                self._notify(post.author, "post_commented", acting_user,
                             f"{self.users[acting_user].full_name} "
                             "commented on your post")
            return comment

    def toggle_comment_like(self, comment_id: int, acting_user: str) -> dict:
        """Like / unlike a comment — same hash-table set pattern as post
        likes, so the membership test is O(1)."""
        with self._lock:
            comment = self.comments_by_id.get(comment_id)
            if comment is None:
                raise ApiError("Comment not found.", 404)
            likers = self.comment_likes.setdefault(comment_id, set())
            if acting_user in likers:
                likers.discard(acting_user)
                db.delete_comment_like(comment_id, acting_user)
                liked = False
            else:
                likers.add(acting_user)
                db.insert_comment_like(comment_id, acting_user, now_iso())
                liked = True
                if comment.author != acting_user:
                    self._notify(comment.author, "comment_liked", acting_user,
                                 f"{self.users[acting_user].full_name} "
                                 "liked your comment")
            return {"liked": liked, "likes": len(likers)}

    # ====================================================================== #
    # Read models (all computed in memory with the DSA modules)
    # ====================================================================== #
    def feed(self, username: str) -> List[dict]:
        """News feed = posts by the user and their first-degree connections,
        ordered newest-first through the heap priority queue."""
        with self._lock:
            authors = self.graph.neighbors(username) | {username}
            candidates = [p for p in self.posts if p.author in authors]
            return [self.serialize_post(p, username)
                    for p in self._heap_ordered(candidates)]

    def posts_by(self, username: str, viewer: str) -> List[dict]:
        with self._lock:
            own = [p for p in self.posts if p.author == username]
            return [self.serialize_post(p, viewer)
                    for p in self._heap_ordered(own)]

    def search(self, query: str, viewer: Optional[str]) -> List[dict]:
        """Prefix search through the Trie + relationship enrichment."""
        with self._lock:
            usernames = self.trie.prefix_matches(query, limit=20)
            results = []
            for username in usernames:
                results.append({
                    **self.user_summary(username),
                    "relationship": self.relationship(viewer, username),
                    "mutual_count": (len(self.graph.mutual(viewer, username))
                                     if viewer else 0),
                })
            return results

    def recommendations(self, viewer: str, limit: int = 10) -> List[dict]:
        """People you may know — Jaccard + mutuals + profile similarity,
        ranked with the bounded top-K heap."""
        with self._lock:
            profiles = {
                user.username: {
                    "programme": user.programme,
                    "year": user.year,
                    "skills": user.skills,
                    "interests": user.interests,
                }
                for user in self.users.values()
            }
            ranked = people_you_may_know(self.graph, viewer, profiles, limit)
            enriched = []
            for info in ranked:
                enriched.append({
                    **self.user_summary(info["username"]),
                    **info,
                    "relationship": self.relationship(viewer, info["username"]),
                })
            return enriched

    def connections_of(self, username: str) -> List[dict]:
        with self._lock:
            neighbors = self.graph.neighbors(username)
            return [{
                **self.user_summary(neighbor),
                "mutual_count": len(self.graph.mutual(username, neighbor)),
            } for neighbor in sorted(neighbors)]

    def degrees_of(self, username: str) -> dict:
        """First / second / third-degree network via BFS levels."""
        with self._lock:
            buckets, beyond = connection_degrees(self.graph, username)
            lists = {
                "first": [self.user_summary(u) for u in sorted(buckets[1])][:50],
                "second": [self.user_summary(u) for u in sorted(buckets[2])][:50],
                "third": [self.user_summary(u) for u in sorted(buckets[3])][:50],
            }
            counts = {
                "first": len(buckets[1]),
                "second": len(buckets[2]),
                "third": len(buckets[3]),
                "beyond": len(beyond),
            }
            return {"counts": counts, "lists": lists}

    def mutual_with(self, username: str, other: str) -> List[dict]:
        with self._lock:
            if other not in self.users:
                raise ApiError("Student not found.", 404)
            return [self.user_summary(m)
                    for m in sorted(self.graph.mutual(username, other))]

    def path_between(self, username: str, other: str) -> dict:
        """Shortest connection chain via BFS (fewest intermediate students)."""
        with self._lock:
            if other not in self.users:
                raise ApiError("Student not found.", 404)
            if other == username:
                raise ApiError("That is your own profile.", 400)
            chain = shortest_path(self.graph, username, other)
            return {
                "source": username,
                "target": other,
                "connected": self.graph.is_connected(username, other),
                "path": chain,
                "distance": (len(chain) - 1) if chain else None,
            }

    def requests_for(self, username: str) -> dict:
        """Pending requests received + sent (FIFO order, oldest first)."""
        with self._lock:
            received, sent = [], []
            for request in sorted(self.requests.values(), key=lambda r: r.id):
                if request.receiver == username:
                    received.append({
                        "id": request.id,
                        "created_at": request.created_at,
                        "sender": self.user_summary(request.sender),
                    })
                if request.sender == username:
                    sent.append({
                        "id": request.id,
                        "created_at": request.created_at,
                        "receiver": self.user_summary(request.receiver),
                    })
            return {"received": received, "sent": sent}

    def user_profile(self, username: str, viewer: Optional[str]) -> dict:
        with self._lock:
            user = self.require_user(username)
            mutual = (self.graph.mutual(viewer, username)
                      if viewer and viewer != username else set())
            return {
                **self.user_summary(username),
                "created_at": user.created_at,
                "relationship": self.relationship(viewer, username),
                "mutual_count": len(mutual),
                "mutual": [self.user_summary(m) for m in sorted(mutual)[:6]],
            }

    def notifications_for(self, username: str, limit: int = 50) -> dict:
        with self._lock:
            notes = self.notifications.get(username, [])
            unread = sum(1 for note in notes if not note.is_read)
            newest_first = list(reversed(notes))[:limit]
            return {
                "notifications": [self._serialize_note(n) for n in newest_first],
                "unread": unread,
            }

    def mark_notifications_read(self, username: str) -> dict:
        with self._lock:
            db.mark_all_notifications_read(username)
            for note in self.notifications.get(username, []):
                note.is_read = True
            return {"ok": True}

    def stats(self) -> dict:
        with self._lock:
            return {
                "students": len(self.users),
                "connections": self.graph.edge_count(),
                "posts": len(self.posts),
                "pending_requests": len(self.requests),
            }

    # ====================================================================== #
    # Serialisation helpers
    # ====================================================================== #
    def relationship(self, viewer: Optional[str], other: str) -> str:
        """self | connected | pending_out | pending_in | none"""
        if viewer is None:
            return "none"
        if viewer == other:
            return "self"
        if self.graph.is_connected(viewer, other):
            return "connected"
        direction = self.graph.pending_direction(viewer, other)
        if direction == "out":
            return "pending_out"
        if direction == "in":
            return "pending_in"
        return "none"

    def user_summary(self, username: str) -> dict:
        user = self.users[username]
        return {
            "username": user.username,
            "full_name": user.full_name,
            "programme": user.programme,
            "year": user.year,
            "bio": user.bio,
            "skills": list(user.skills),
            "interests": list(user.interests),
            "avatar_url": user.avatar_url,
            "cover_url": user.cover_url,
            "connections_count": self.graph.degree(username),
            "posts_count": self._post_counts.get(username, 0),
        }

    def serialize_post(self, post: Post, viewer: Optional[str]) -> dict:
        likers = self.likes.get(post.id, set())
        return {
            "id": post.id,
            "author": self.user_summary(post.author),
            "content": post.content,
            "created_at": post.created_at,
            "media_url": post.media_url,
            "media_type": post.media_type,
            "likes": len(likers),
            "liked_by_me": bool(viewer and viewer in likers),
            "comments": [self.serialize_comment(comment, viewer)
                         for comment in self.comments.get(post.id, [])],
            "is_mine": bool(viewer and post.author == viewer),
        }

    def serialize_comment(self, comment: Comment, viewer: Optional[str]) -> dict:
        """One comment with its like state (O(1) hash-table lookup)."""
        likers = self.comment_likes.get(comment.id, set())
        return {
            "id": comment.id,
            "author": self.user_summary(comment.author),
            "content": comment.content,
            "created_at": comment.created_at,
            "likes": len(likers),
            "liked_by_me": bool(viewer and viewer in likers),
        }

    def _serialize_note(self, note: Notification) -> dict:
        actor = (self.user_summary(note.actor)
                 if note.actor and note.actor in self.users else None)
        return {
            "id": note.id,
            "kind": note.kind,
            "actor": actor,
            "message": note.message,
            "is_read": note.is_read,
            "created_at": note.created_at,
        }

    # ====================================================================== #
    # Internal utilities
    # ====================================================================== #
    def _heap_ordered(self, posts: List[Post]) -> List[Post]:
        """Newest-first ordering via the priority queue.

        The heap key is -timestamp (a max-heap on time): the smallest key is
        the newest post, so repeated pops yield strictly newest-first order.
        """
        heap = MinHeap.heapify(posts, key=lambda post: -ts_of(post.created_at))
        ordered: List[Post] = []
        while not heap.is_empty():
            ordered.append(heap.pop())
        return ordered

    def _notify(self, recipient: str, kind: str, actor: str, message: str) -> None:
        """Enqueue a notification for a student (FIFO per recipient)."""
        created = now_iso()
        note = Notification(
            db.insert_notification(recipient, kind, actor, message, created),
            recipient, kind, actor, message, False, created,
        )
        self.notifications.setdefault(recipient, []).append(note)


# Module-level singleton shared by every Flask route.
network_state = Network()
