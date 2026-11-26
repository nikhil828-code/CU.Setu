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
from dsa.analytics import (complementary_skills, group_distribution,
                            skill_counts, students_with_skill, top_skills)
from dsa.bfs import bfs_levels, bfs_trace, connection_degrees, shortest_path
from dsa.graph import SocialGraph
from dsa.heap import MinHeap
from dsa.matching import rank_candidates
from dsa.playground import (graph_build_trace, heap_trace, hashmap_trace,
                             trie_insert_trace, trie_search_trace,
                             trie_serialize)
from dsa.recommendations import people_you_may_know, smart_discovery
from dsa.trie import Trie
from errors import ApiError          # re-exported for the route layer
from models import (Collab, CollabApplication, CollabMember, Comment,
                    ConnectionRequest, Notification, Post, ProjectContributor,
                    ShowcaseProject, User, hash_password, verify_password)
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
        # Collaboration Hub: posted ideas, team rosters, pending applications
        self.collabs: Dict[int, Collab] = {}
        self.collab_members: Dict[int, List[CollabMember]] = {}
        self.collab_apps: Dict[int, CollabApplication] = {}
        # Project Showcase: published projects + credited contributors
        self.projects: Dict[int, ShowcaseProject] = {}
        self.project_contributors: Dict[int, List[ProjectContributor]] = {}
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
            self.collabs = {}
            self.collab_members = {}
            self.collab_apps = {}
            self.projects = {}
            self.project_contributors = {}
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

            for collab in db.fetch_collabs():
                self.collabs[collab.id] = collab
                self.collab_members.setdefault(collab.id, [])
            for member in db.fetch_collab_members():
                self.collab_members.setdefault(member.collab_id, []).append(member)
            for app in db.fetch_collab_applications():
                self.collab_apps[app.id] = app

            for project in db.fetch_projects():
                self.projects[project.id] = project
                self.project_contributors.setdefault(project.id, [])
            for contributor in db.fetch_project_contributors():
                self.project_contributors.setdefault(contributor.project_id, []).append(contributor)

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

    def add_comment(self, post_id: int, acting_user: str, content: str,
                    parent_id: int | None = None) -> Comment:
        """Add a comment, or — when parent_id is given — a reply to an
        existing comment on the same post (one nesting level)."""
        content = (content or "").strip()
        if not content:
            raise ApiError("Comment cannot be empty.", 400)
        if len(content) > 500:
            raise ApiError("Comments are limited to 500 characters.", 400)

        parent: Comment | None = None
        if parent_id is not None:
            try:
                parent_id = int(parent_id)
            except (TypeError, ValueError):
                raise ApiError("Invalid reply target.", 400)

        with self._lock:
            post = self.posts_by_id.get(post_id)
            if post is None:
                raise ApiError("Post not found.", 404)
            if parent_id is not None:
                # Hash-table lookup: the parent comment in O(1).
                parent = self.comments_by_id.get(parent_id)
                if parent is None:
                    raise ApiError("The comment you replied to no longer exists.", 404)
                if parent.post_id != post_id:
                    raise ApiError("You can only reply to comments on the same post.", 400)
                if parent.parent_id is not None:
                    # Keep threads one level deep — treat a reply-to-reply
                    # as a reply to the parent thread's top-level comment.
                    parent_id = parent.parent_id
                    parent = self.comments_by_id[parent_id]
            created = now_iso()
            comment = Comment(db.insert_comment(post_id, acting_user, content,
                                                created, parent_id),
                              post_id, acting_user, content, created, parent_id)
            self.comments.setdefault(post_id, []).append(comment)
            self.comments_by_id[comment.id] = comment
            actor_name = self.users[acting_user].full_name
            if parent is not None:
                if parent.author != acting_user:
                    self._notify(parent.author, "comment_replied", acting_user,
                                 f"{actor_name} replied to your comment")
            elif post.author != acting_user:
                self._notify(post.author, "post_commented", acting_user,
                             f"{actor_name} commented on your post")
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

    def smart_discovery(self, viewer: str, limit: int = 12,
                        weights: Optional[dict] = None) -> List[dict]:
        """Smart Discovery 2.0 — weighted compatibility ranking (Python heap).

        Weights (mutual 40% / skills 30% / interests 20% / major 10% by
        default) are configurable per request; factors are Jaccard
        similarities computed on the in-memory graph and profile sets."""
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
            ranked = smart_discovery(self.graph, viewer, profiles, limit, weights)
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
            if username not in self.users:
                raise ApiError("Student not found.", 404)
            if other not in self.users:
                raise ApiError("Student not found.", 404)
            if other == username:
                raise ApiError("Pick two different students.", 400)
            chain = shortest_path(self.graph, username, other)
            return {
                "source": username,
                "target": other,
                "connected": self.graph.is_connected(username, other),
                "path": chain,
                "distance": (len(chain) - 1) if chain else None,
            }

    # ====================================================================== #
    # Network Explorer — whole-graph payload + animated BFS trace
    # ====================================================================== #
    def network_graph(self, viewer: str) -> dict:
        """Every student as a node (with graph degree + BFS level from the
        viewer) and every ACCEPTED connection as an undirected edge.
        Pending requests are deliberately NOT edges — the explorer shows the
        real, accepted network only."""
        with self._lock:
            levels = bfs_levels(self.graph, viewer)
            nodes = [{
                **self.user_summary(username),
                "level": levels.get(username),
            } for username in sorted(self.users)]
            edges = [{"source": a, "target": b}
                     for a, b in self.graph.edge_pairs()]
            total_degree = sum(node["connections_count"] for node in nodes)
            return {
                "viewer": viewer,
                "nodes": nodes,
                "edges": edges,
                "stats": {
                    "nodes": len(nodes),
                    "edges": len(edges),
                    "avg_degree": (round(total_degree / len(nodes), 2)
                                   if nodes else 0),
                },
            }

    def network_bfs(self, source: str) -> dict:
        """Animated BFS from any student: one step per dequeue, carrying the
        discovering parent, the BFS level, and the frontier snapshot —
        computed by the real dsa.bfs algorithm over the in-memory graph."""
        with self._lock:
            if source not in self.users:
                raise ApiError("Student not found.", 404)
            steps = bfs_trace(self.graph, source)
            return {
                "source": source,
                "steps": steps,
                "reachable": len(steps),
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
    # Collaboration Hub — project ideas, applications, skill-matched rosters
    # ====================================================================== #
    def _require_collab(self, collab_id: int) -> Collab:
        collab = self.collabs.get(collab_id)
        if collab is None:
            raise ApiError("Collaboration not found.", 404)
        return collab

    def _collab_roster(self, collab_id: int) -> List[CollabMember]:
        return self.collab_members.get(collab_id, [])

    def _collab_pending(self, collab_id: int) -> List[CollabApplication]:
        return [app for app in self.collab_apps.values()
                if app.collab_id == collab_id]

    def serialize_collab(self, collab: Collab, viewer: str) -> dict:
        roster = self._collab_roster(collab.id)
        members = [self.user_summary(m.username) for m in roster]
        pending = self._collab_pending(collab.id)
        mine = next((app for app in pending if app.applicant == viewer), None)
        my_role = next((m.role for m in roster if m.username == viewer), None)
        return {
            "id": collab.id,
            "owner": self.user_summary(collab.owner),
            "title": collab.title,
            "description": collab.description,
            "category": collab.category,
            "skills_needed": collab.skills_needed,
            "team_size": collab.team_size,
            "status": collab.status,
            "created_at": collab.created_at,
            "members": members,
            "member_count": len(members),
            "open_spots": max(0, collab.team_size - len(members)),
            "pending_count": len(pending),
            "is_owner": collab.owner == viewer,
            "my_status": ("owner" if my_role == "owner"
                          else "member" if my_role
                          else "applied" if mine
                          else "none"),
        }

    def collabs_for(self, viewer: str) -> List[dict]:
        """Every collaboration, newest first, serialized for the viewer."""
        with self._lock:
            return [self.serialize_collab(collab, viewer)
                    for collab in sorted(self.collabs.values(),
                                         key=lambda c: c.id, reverse=True)]

    def collab_create(self, owner: str, title: str, description: str,
                      category: str, skills: List[str], team_size: int) -> dict:
        """Post a new project idea; the owner is the first team member."""
        title = (title or "").strip()
        description = (description or "").strip()
        category = (category or "General").strip() or "General"
        if not (4 <= len(title) <= 80):
            raise ApiError("Give the idea a title of 4-80 characters.", 400)
        if len(description) > 600:
            raise ApiError("Keep the description under 600 characters.", 400)
        clean_skills = [s.strip() for s in skills if s and s.strip()][:8]
        if not (2 <= int(team_size) <= 10):
            raise ApiError("Team size must be between 2 and 10.", 400)

        with self._lock:
            created = now_iso()
            collab = Collab(
                db.insert_collab(owner, title, description, category,
                                 ",".join(clean_skills), int(team_size), created),
                owner, title, description, category, clean_skills,
                int(team_size), "open", created,
            )
            self.collabs[collab.id] = collab
            self.collab_members[collab.id] = [CollabMember(collab.id, owner, "owner", created)]
            db.insert_collab_member(collab.id, owner, "owner", created)
            return self.serialize_collab(collab, owner)

    def collab_apply(self, applicant: str, collab_id: int, message: str) -> dict:
        """Apply to join: lands in the owner's pending application queue."""
        with self._lock:
            collab = self._require_collab(collab_id)
            roster = {m.username for m in self._collab_roster(collab.id)}
            if applicant in roster:
                raise ApiError("You are already on this team.", 400)
            if any(app.collab_id == collab.id and app.applicant == applicant
                   for app in self.collab_apps.values()):
                raise ApiError("Your application is already pending.", 400)
            if collab.status != "open":
                raise ApiError("This collaboration is closed.", 400)
            if len(roster) >= collab.team_size:
                raise ApiError("This team is already full.", 400)
            if len(message) > 300:
                raise ApiError("Keep the application message under 300 characters.", 400)

            created = now_iso()
            app = CollabApplication(
                db.insert_collab_application(collab.id, applicant, message.strip(), created),
                collab.id, applicant, message.strip(), "pending", created,
            )
            self.collab_apps[app.id] = app
            self._notify(collab.owner, "collab_application", applicant,
                         f"@{applicant} applied to join \"{collab.title}\".")
            return {"ok": True, "status": "applied"}

    def collab_applications_for(self, owner: str) -> List[dict]:
        """Pending applications for every collaboration this student owns."""
        with self._lock:
            result = []
            for app in sorted(self.collab_apps.values(), key=lambda a: a.id):
                collab = self.collabs.get(app.collab_id)
                if collab is None or collab.owner != owner:
                    continue
                result.append({
                    "id": app.id,
                    "collab_id": collab.id,
                    "collab_title": collab.title,
                    "message": app.message,
                    "created_at": app.created_at,
                    "applicant": self.user_summary(app.applicant),
                })
            return result

    def _finish_collab_application(self, app_id: int, acting_owner: str,
                                   accept: bool) -> dict:
        app = self.collab_apps.get(app_id)
        if app is None:
            raise ApiError("Application not found.", 404)
        collab = self._require_collab(app.collab_id)
        if collab.owner != acting_owner:
            raise ApiError("Only the owner can decide applications.", 403)
        with self._lock:
            del self.collab_apps[app_id]
            db.delete_collab_application(app_id)
            if accept:
                joined = now_iso()
                member = CollabMember(collab.id, app.applicant, "member", joined)
                roster = self.collab_members.setdefault(collab.id, [])
                if app.applicant not in {m.username for m in roster}:
                    roster.append(member)
                db.insert_collab_member(collab.id, app.applicant, "member", joined)
                # accept may fill the last spot — close automatically
                if len(roster) >= collab.team_size and collab.status == "open":
                    collab.status = "closed"
                    db.update_collab_status(collab.id, "closed")
                self._notify(app.applicant, "collab_accepted", acting_owner,
                            f"You joined \"{collab.title}\" — welcome aboard!")
                return {"ok": True, "joined": collab.title}
            self._notify(app.applicant, "collab_rejected", acting_owner,
                         f"Your application for \"{collab.title}\" was not accepted.")
            return {"ok": True, "rejected": app.applicant}

    def collab_accept(self, owner: str, app_id: int) -> dict:
        """Accept an application -> the applicant joins the roster."""
        return self._finish_collab_application(app_id, owner, accept=True)

    def collab_reject(self, owner: str, app_id: int) -> dict:
        """Reject an application (the pending row is removed)."""
        return self._finish_collab_application(app_id, owner, accept=False)

    def collab_set_status(self, owner: str, collab_id: int, closed: bool) -> dict:
        """Owner closes / reopens recruiting."""
        with self._lock:
            collab = self._require_collab(collab_id)
            if collab.owner != owner:
                raise ApiError("Only the owner can change recruiting status.", 403)
            roster = self._collab_roster(collab.id)
            if closed is False and len(roster) >= collab.team_size:
                raise ApiError("The team is full — increase the size to reopen.", 400)
            collab.status = "closed" if closed else "open"
            db.update_collab_status(collab.id, collab.status)
            return {"ok": True, "status": collab.status}

    def collab_delete(self, owner: str, collab_id: int) -> dict:
        """Delete an owned collaboration (roster + applications go too)."""
        with self._lock:
            collab = self._require_collab(collab_id)
            if collab.owner != owner:
                raise ApiError("Only the owner can delete this collaboration.", 403)
            self.collab_apps = {k: v for k, v in self.collab_apps.items()
                                if v.collab_id != collab_id}
            self.collab_members.pop(collab_id, None)
            del self.collabs[collab_id]
            db.delete_collab(collab_id)
            return {"ok": True, "deleted": collab_id}

    def collab_candidates(self, owner: str, collab_id: int,
                          limit: int = 10) -> List[dict]:
        """Suggested teammates: hash-indexed skills + set matching + heap."""
        with self._lock:
            collab = self._require_collab(collab_id)
            if collab.owner != owner:
                raise ApiError("Only the owner can see ranked candidates.", 403)
            profiles = {
                user.username: {
                    "skills": user.skills,
                    "interests": user.interests,
                    "programme": user.programme,
                }
                for user in self.users.values()
            }
            exclude = ({collab.owner}
                       | {m.username for m in self._collab_roster(collab.id)}
                       | {a.applicant for a in self._collab_pending(collab.id)})
            ranked = rank_candidates(collab.skills_needed, profiles, exclude, limit)
            enriched = []
            for info in ranked:
                enriched.append({
                    **self.user_summary(info["username"]),
                    **info,
                    "relationship": self.relationship(owner, info["username"]),
                })
            return enriched

    # ====================================================================== #
    # DSA Playground — traces generated by the real algorithms
    # ====================================================================== #
    def playground_graph(self) -> dict:
        """Graph build trace over the live student network."""
        with self._lock:
            students = sorted(self.users)
            steps = graph_build_trace(self.graph, students)
            nodes = [{
                "username": username,
                "full_name": self.users[username].full_name,
                "degree": self.graph.degree(username),
            } for username in students]
            return {
                "nodes": nodes,
                "edges": [{"source": a, "target": b}
                          for a, b in self.graph.edge_pairs()],
                "steps": steps,
                "stats": {
                    "vertices": len(students),
                    "edges": self.graph.edge_count(),
                },
            }

    def playground_trie(self) -> dict:
        """Build a Trie live from the first students' searchable keywords."""
        with self._lock:
            words: List[Tuple[str, str]] = []
            for username in sorted(self.users)[:12]:
                user = self.users[username]
                words.append((username, username))
                for name_word in user.full_name.split():
                    name_word = name_word.strip().lower()
                    if name_word:
                        words.append((name_word, username))
            trie, steps = trie_insert_trace(words)
            return {
                "words": [{"word": w, "owner": o} for w, o in words],
                "steps": steps,
                "tree": trie_serialize(trie.root),
            }

    def playground_trie_search(self, prefix: str) -> dict:
        """Prefix search replayed on the REAL in-memory trie (every student)."""
        with self._lock:
            prefix = (prefix or "").strip().lower()
            if not prefix:
                raise ApiError("Type at least one character to search.", 400)
            steps, matches = trie_search_trace(self.trie, prefix)
            matched_names = [{"username": m, "full_name": self.users[m].full_name}
                             for m in matches if m in self.users]
            return {"prefix": prefix, "steps": steps,
                    "matches": matched_names}

    def playground_heap(self, values: Optional[List[float]] = None) -> dict:
        """Min-heap animation: real student connection counts (default) or
        custom numbers supplied by the learner."""
        with self._lock:
            if values:
                clean = []
                for value in values[:24]:
                    try:
                        clean.append((f"v{len(clean) + 1}", float(value)))
                    except (TypeError, ValueError):
                        continue
                labels_note = "custom values"
            else:
                clean = [(username, float(self.graph.degree(username)))
                         for username in sorted(self.users)]
                labels_note = "each student's connection count (real data)"
            steps = heap_trace(clean)
            return {
                "mode": labels_note,
                "items": [{"label": label, "value": value} for label, value in clean],
                "steps": steps,
            }

    def playground_hashmap(self) -> dict:
        """Hash-map skill counter over every real student profile."""
        with self._lock:
            profiles = {
                user.username: {"skills": user.skills}
                for user in self.users.values()
            }
            return hashmap_trace(profiles, capacity=8)

    # ====================================================================== #
    # Project Showcase — published projects, covers, contributors, featured
    # ====================================================================== #
    def serialize_project(self, project: ShowcaseProject, viewer: str) -> dict:
        contributors = [self.user_summary(c.username)
                        for c in self.project_contributors.get(project.id, [])]
        return {
            "id": project.id,
            "owner": self.user_summary(project.owner),
            "title": project.title,
            "description": project.description,
            "cover_url": project.cover_url,
            "tech_stack": project.tech_stack,
            "github_url": project.github_url,
            "demo_url": project.demo_url,
            "category": project.category,
            "featured": project.featured,
            "created_at": project.created_at,
            "contributors": contributors,
            "is_mine": project.owner == viewer,
        }

    def projects_for(self, viewer: str, category: str = "") -> List[dict]:
        """Every published project (newest first), optionally filtered by
        category. Featured ones are flagged for the spotlight section."""
        with self._lock:
            wanted = category.strip().lower()
            return [self.serialize_project(project, viewer)
                    for project in sorted(self.projects.values(),
                                           key=lambda p: p.id, reverse=True)
                    if not wanted or project.category.strip().lower() == wanted]

    def _require_project(self, project_id: int) -> ShowcaseProject:
        project = self.projects.get(project_id)
        if project is None:
            raise ApiError("Project not found.", 404)
        return project

    @staticmethod
    def _clean_project_fields(title: str, description: str, tech_stack: list,
                               github_url: str, demo_url: str) -> dict:
        title = (title or "").strip()
        description = (description or "").strip()
        if not (4 <= len(title) <= 80):
            raise ApiError("Give the project a title of 4-80 characters.", 400)
        if len(description) > 800:
            raise ApiError("Keep the description under 800 characters.", 400)
        skills = [s.strip() for s in tech_stack if s and s.strip()][:10]
        github_url = (github_url or "").strip()
        demo_url = (demo_url or "").strip()
        for label, url in (("GitHub", github_url), ("Demo", demo_url)):
            if url and not url.startswith(("http://", "https://")):
                raise ApiError(f"{label} links must start with http:// or https://.", 400)
        return {"title": title, "description": description,
                "skills": skills, "github_url": github_url, "demo_url": demo_url}

    def project_create(self, owner: str, title: str, description: str,
                       cover_url: str, tech_stack: list, github_url: str,
                       demo_url: str, category: str) -> dict:
        """Publish a project (optionally with an uploaded cover image)."""
        fields = self._clean_project_fields(title, description, tech_stack,
                                            github_url, demo_url)
        category = (category or "General").strip() or "General"
        with self._lock:
            created = now_iso()
            project = ShowcaseProject(
                db.insert_project(owner, fields["title"], fields["description"],
                                  cover_url, ",".join(fields["skills"]),
                                  fields["github_url"], fields["demo_url"],
                                  category, created),
                owner, fields["title"], fields["description"], cover_url,
                fields["skills"], fields["github_url"], fields["demo_url"],
                category, False, created,
            )
            self.projects[project.id] = project
            self.project_contributors[project.id] = []
            return self.serialize_project(project, owner)

    def project_update(self, owner: str, project_id: int, title: str,
                       description: str, cover_url: str, tech_stack: list,
                       github_url: str, demo_url: str, category: str) -> dict:
        """Edit an owned project (cover_url '' means 'keep existing')."""
        with self._lock:
            project = self._require_project(project_id)
            if project.owner != owner:
                raise ApiError("Only the owner can edit this project.", 403)
            fields = self._clean_project_fields(title, description, tech_stack,
                                                github_url, demo_url)
            category = (category or "General").strip() or "General"
            new_cover = cover_url if cover_url else project.cover_url
            project.title = fields["title"]
            project.description = fields["description"]
            project.cover_url = new_cover
            project.tech_stack = fields["skills"]
            project.github_url = fields["github_url"]
            project.demo_url = fields["demo_url"]
            project.category = category
            db.update_project(project.id, project.title, project.description,
                               project.cover_url, ",".join(project.tech_stack),
                               project.github_url, project.demo_url,
                               project.category)
            return self.serialize_project(project, owner)

    def project_toggle_featured(self, owner: str, project_id: int) -> dict:
        """Owner toggles the spotlight (featured) flag on their project."""
        with self._lock:
            project = self._require_project(project_id)
            if project.owner != owner:
                raise ApiError("Only the owner can feature this project.", 403)
            project.featured = not project.featured
            db.set_project_featured(project.id, project.featured)
            return {"ok": True, "featured": project.featured}

    def project_delete(self, owner: str, project_id: int) -> dict:
        """Delete an owned project (contributors go with it)."""
        with self._lock:
            project = self._require_project(project_id)
            if project.owner != owner:
                raise ApiError("Only the owner can delete this project.", 403)
            self.project_contributors.pop(project_id, None)
            del self.projects[project_id]
            db.delete_project(project_id)
            return {"ok": True, "deleted": project_id}

    def project_add_contributor(self, owner: str, project_id: int,
                                username: str) -> dict:
        """Credit a contributor on an owned project."""
        username = (username or "").strip().lower()
        with self._lock:
            project = self._require_project(project_id)
            if project.owner != owner:
                raise ApiError("Only the owner can add contributors.", 403)
            if username not in self.users:
                raise ApiError("Student not found.", 404)
            if username == project.owner:
                raise ApiError("The owner is already credited.", 400)
            roster = self.project_contributors.setdefault(project_id, [])
            if any(c.username == username for c in roster):
                raise ApiError("@%s is already credited." % username, 400)
            added = now_iso()
            roster.append(ProjectContributor(project_id, username, added))
            db.insert_project_contributor(project_id, username, added)
            self._notify(username, "project_contributor", owner,
                         f"@{owner} credited you as a contributor on \"{project.title}\".")
            return {"ok": True, "added": username}

    def project_remove_contributor(self, owner: str, project_id: int,
                                   username: str) -> dict:
        """Remove a credited contributor from an owned project."""
        username = (username or "").strip().lower()
        with self._lock:
            project = self._require_project(project_id)
            if project.owner != owner:
                raise ApiError("Only the owner can remove contributors.", 403)
            roster = self.project_contributors.get(project_id, [])
            if not any(c.username == username for c in roster):
                raise ApiError("That student is not credited on this project.", 404)
            self.project_contributors[project_id] = [
                c for c in roster if c.username != username]
            db.delete_project_contributor(project_id, username)
            return {"ok": True, "removed": username}

    # ====================================================================== #
    # Campus Skill Analytics — hash-map counts, heap rankings, set logic
    # ====================================================================== #
    def _profile_view(self) -> Dict[str, dict]:
        """username -> {programme, year, skills, interests} for the analytics
        and matching engines (a read-only projection of the user hash table)."""
        return {
            user.username: {
                "programme": user.programme,
                "year": user.year,
                "skills": user.skills,
                "interests": user.interests,
            }
            for user in self.users.values()
        }

    def skill_analytics(self) -> dict:
        """The whole analytics payload, computed live from real profiles."""
        with self._lock:
            profiles = self._profile_view()
            counts = skill_counts(profiles)
            top = top_skills(counts, 12)
            students_count = len(self.users)
            for entry in top:
                entry["pct"] = round(100 * entry["count"] / students_count, 1) if students_count else 0
            by_programme = group_distribution(profiles, "programme")
            by_year = group_distribution(profiles, "year")
            return {
                "students": students_count,
                "distinct_skills": len(counts),
                "total_listings": sum(counts.values()),
                "top": top,
                "by_programme": by_programme,
                "by_year": by_year,
            }

    def students_by_skill(self, skill: str) -> List[dict]:
        """Who knows this skill? Inverted-index lookup + rich summaries."""
        with self._lock:
            if not skill or not skill.strip():
                raise ApiError("Type a skill to search for.", 400)
            profiles = self._profile_view()
            usernames = students_with_skill(profiles, skill)
            wanted = skill.strip().lower()
            return [self.user_summary(u) for u in usernames
                    if wanted in {s.strip().lower() for s in self.users[u].skills}]

    def complementary_for_skill(self, skill: str) -> dict:
        """Skills that pair best with the given skill (set co-occurrence)."""
        with self._lock:
            if not skill or not skill.strip():
                raise ApiError("Type a skill first.", 400)
            profiles = self._profile_view()
            wanted = skill.strip().lower()
            exists = any(wanted in {s.strip().lower() for s in p.get("skills", [])}
                        for p in profiles.values())
            if not exists:
                raise ApiError("No student on campus has that skill yet.", 404)
            ranked = complementary_skills(profiles, wanted)
            return {"skill": wanted, "complementary": ranked}


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
        # Group the flat chronological comment list into threads: top-level
        # comments first, their replies nested one level under each parent.
        flat = self.comments.get(post.id, [])
        children: Dict[int, List[Comment]] = {}
        top_level: List[Comment] = []
        for comment in flat:
            if comment.parent_id is None:
                top_level.append(comment)
            else:
                children.setdefault(comment.parent_id, []).append(comment)
        return {
            "id": post.id,
            "author": self.user_summary(post.author),
            "content": post.content,
            "created_at": post.created_at,
            "media_url": post.media_url,
            "media_type": post.media_type,
            "likes": len(likers),
            "liked_by_me": bool(viewer and viewer in likers),
            "comments": [self.serialize_comment(comment, viewer,
                                                replies=children.get(comment.id, []))
                         for comment in top_level],
            "is_mine": bool(viewer and post.author == viewer),
        }

    def serialize_comment(self, comment: Comment, viewer: Optional[str],
                          replies: Optional[List[Comment]] = None) -> dict:
        """One comment with its like state (O(1) hash-table lookup) and,
        when supplied, its direct replies nested beneath it."""
        likers = self.comment_likes.get(comment.id, set())
        return {
            "id": comment.id,
            "author": self.user_summary(comment.author),
            "content": comment.content,
            "created_at": comment.created_at,
            "likes": len(likers),
            "liked_by_me": bool(viewer and viewer in likers),
            "parent_id": comment.parent_id,
            "replies": [self.serialize_comment(reply, viewer)
                        for reply in (replies or [])],
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
