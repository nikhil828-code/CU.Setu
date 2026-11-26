"""
SQLite persistence layer.

DSA REQUIREMENT (deliberate design)
------------------------------------
SQLite here is ONLY durable storage — a "save file". At startup the app
loads every row into in-memory data structures:

    users        -> hash table  username -> User
    connections  -> SocialGraph adjacency lists (undirected edges)
    requests     -> graph pending edges + a pending-request queue
    posts/likes  -> list + hash tables
    notifications -> per-student FIFO queues

ALL graph algorithms (BFS, mutual connections, recommendations, feed
ordering, search) then run against MEMORY — never through SQL. Every
mutation updates memory first and mirrors the change back to SQLite so
the data survives restarts.

Each function opens its own short-lived connection, which makes the layer
safe under Flask's multi-threaded dev server.
"""

import sqlite3
from typing import Dict, List, Optional, Set, Tuple

from config import DB_PATH
from models import Comment, ConnectionRequest, Notification, Post, User
import models.connection as connection_status
from models import (Collab, CollabApplication, CollabMember, ProjectContributor,
                    ShowcaseProject)

# --------------------------------------------------------------------------- #
# Schema
# --------------------------------------------------------------------------- #
_SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    username      TEXT PRIMARY KEY,          -- unique usernames enforced here too
    password_hash TEXT NOT NULL,
    full_name     TEXT NOT NULL,
    programme     TEXT NOT NULL DEFAULT '',
    year          TEXT NOT NULL DEFAULT '',
    bio           TEXT NOT NULL DEFAULT '',
    skills        TEXT NOT NULL DEFAULT '',  -- comma separated (SQLite has no arrays)
    interests     TEXT NOT NULL DEFAULT '',
    avatar_url    TEXT NOT NULL DEFAULT '',  -- uploaded profile photo URL
    cover_url     TEXT NOT NULL DEFAULT '',  -- uploaded profile background URL
    created_at    TEXT NOT NULL
);

-- Accepted connections: one row per undirected edge (user_a < user_b).
CREATE TABLE IF NOT EXISTS connections (
    user_a      TEXT NOT NULL,
    user_b      TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    PRIMARY KEY (user_a, user_b),
    CHECK (user_a < user_b)
);

-- Pending requests only. Accepted/rejected/cancelled rows are deleted,
-- keeping this table a true "queue of pending requests".
CREATE TABLE IF NOT EXISTS requests (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    sender     TEXT NOT NULL,
    receiver   TEXT NOT NULL,
    status     TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL,
    UNIQUE (sender, receiver)
);

CREATE TABLE IF NOT EXISTS posts (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    author     TEXT NOT NULL,
    content    TEXT NOT NULL,
    media_url  TEXT NOT NULL DEFAULT '',   -- uploaded photo / video URL
    media_type TEXT NOT NULL DEFAULT '',   -- '' | 'image' | 'video'
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS likes (
    post_id    INTEGER NOT NULL,
    username   TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (post_id, username)          -- one like per user per post
);

CREATE TABLE IF NOT EXISTS comments (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id    INTEGER NOT NULL,
    author     TEXT NOT NULL,
    content    TEXT NOT NULL,
    created_at TEXT NOT NULL,
    parent_id  INTEGER                              -- NULL = top-level comment
);

-- Comment likes: same "one like per user" rule as post likes.
CREATE TABLE IF NOT EXISTS comment_likes (
    comment_id INTEGER NOT NULL,
    username   TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (comment_id, username)
);

-- Collaboration Hub: posted project ideas looking for a team.
CREATE TABLE IF NOT EXISTS collabs (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    owner         TEXT NOT NULL,
    title         TEXT NOT NULL,
    description   TEXT NOT NULL DEFAULT '',
    category      TEXT NOT NULL DEFAULT 'General',
    skills_needed TEXT NOT NULL DEFAULT '',   -- comma separated
    team_size     INTEGER NOT NULL DEFAULT 4,
    status        TEXT NOT NULL DEFAULT 'open',  -- open | closed
    created_at    TEXT NOT NULL
);

-- Collaboration Hub: one row per student on a team (owner + members).
CREATE TABLE IF NOT EXISTS collab_members (
    collab_id  INTEGER NOT NULL,
    username   TEXT NOT NULL,
    role       TEXT NOT NULL DEFAULT 'member',  -- owner | member
    joined_at  TEXT NOT NULL,
    PRIMARY KEY (collab_id, username)
);

-- Collaboration Hub: PENDING join applications only. Accept/reject
-- delete the row (the same pure-queue convention as connection requests).
CREATE TABLE IF NOT EXISTS collab_applications (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    collab_id  INTEGER NOT NULL,
    applicant  TEXT NOT NULL,
    message    TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    UNIQUE (collab_id, applicant)
);

-- Project Showcase: published student projects.
CREATE TABLE IF NOT EXISTS projects (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    owner        TEXT NOT NULL,
    title        TEXT NOT NULL,
    description  TEXT NOT NULL DEFAULT '',
    cover_url    TEXT NOT NULL DEFAULT '',   -- uploaded cover image URL
    tech_stack   TEXT NOT NULL DEFAULT '',   -- comma separated
    github_url   TEXT NOT NULL DEFAULT '',
    demo_url     TEXT NOT NULL DEFAULT '',
    category     TEXT NOT NULL DEFAULT 'General',
    featured     INTEGER NOT NULL DEFAULT 0,  -- owner-toggled spotlight
    created_at   TEXT NOT NULL
);

-- Project Showcase: credited contributors per project.
CREATE TABLE IF NOT EXISTS project_contributors (
    project_id INTEGER NOT NULL,
    username   TEXT NOT NULL,
    added_at   TEXT NOT NULL,
    PRIMARY KEY (project_id, username)
);

CREATE TABLE IF NOT EXISTS notifications (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    recipient  TEXT NOT NULL,
    kind       TEXT NOT NULL,
    actor      TEXT NOT NULL DEFAULT '',
    message    TEXT NOT NULL,
    is_read    INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);
"""

# Columns added after the first release — applied to older database files
# with ALTER TABLE so existing data survives the upgrade untouched.
_MIGRATIONS = (
    "ALTER TABLE users ADD COLUMN avatar_url TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE users ADD COLUMN cover_url TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE posts ADD COLUMN media_url TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE posts ADD COLUMN media_type TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE comments ADD COLUMN parent_id INTEGER",
)


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    """Create all tables if they do not exist yet, then apply any column
    migrations an older database file may still be missing."""
    conn = _connect()
    try:
        with conn:
            conn.executescript(_SCHEMA)
            for statement in _MIGRATIONS:
                try:
                    conn.execute(statement)
                except sqlite3.OperationalError:
                    # Column already exists — nothing to migrate.
                    pass
    finally:
        conn.close()


# --------------------------------------------------------------------------- #
# Users
# --------------------------------------------------------------------------- #
def insert_user(user: User) -> None:
    conn = _connect()
    try:
        with conn:
            conn.execute(
                "INSERT INTO users (username, password_hash, full_name, programme,"
                " year, bio, skills, interests, avatar_url, cover_url, created_at)"
                " VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                (user.username, user.password_hash, user.full_name, user.programme,
                 user.year, user.bio, ",".join(user.skills),
                 ",".join(user.interests), user.avatar_url, user.cover_url,
                 user.created_at),
            )
    finally:
        conn.close()


def fetch_all_users() -> List[User]:
    conn = _connect()
    try:
        rows = conn.execute("SELECT * FROM users ORDER BY created_at, username").fetchall()
    finally:
        conn.close()
    return [
        User(
            username=row["username"],
            full_name=row["full_name"],
            password_hash=row["password_hash"],
            programme=row["programme"],
            year=row["year"],
            bio=row["bio"],
            skills=[s for s in row["skills"].split(",") if s],
            interests=[s for s in row["interests"].split(",") if s],
            avatar_url=row["avatar_url"] or "",
            cover_url=row["cover_url"] or "",
            created_at=row["created_at"],
        )
        for row in rows
    ]


def update_user_profile(username: str, full_name: str, programme: str,
                         year: str, bio: str, skills: List[str],
                         interests: List[str]) -> None:
    conn = _connect()
    try:
        with conn:
            conn.execute(
                "UPDATE users SET full_name=?, programme=?, year=?, bio=?,"
                " skills=?, interests=? WHERE username=?",
                (full_name, programme, year, bio,
                 ",".join(skills), ",".join(interests), username),
            )
    finally:
        conn.close()


def update_user_media(username: str, avatar_url: Optional[str] = None,
                      cover_url: Optional[str] = None) -> None:
    """Persist an uploaded profile photo / profile background URL.

    Only the supplied field is written, so each upload updates exactly one
    column (None = leave unchanged, "" = clear back to the default).
    """
    assignments, params = [], []
    if avatar_url is not None:
        assignments.append("avatar_url=?")
        params.append(avatar_url)
    if cover_url is not None:
        assignments.append("cover_url=?")
        params.append(cover_url)
    if not assignments:
        return
    params.append(username)
    conn = _connect()
    try:
        with conn:
            conn.execute(
                f"UPDATE users SET {', '.join(assignments)} WHERE username=?",
                tuple(params),
            )
    finally:
        conn.close()


# --------------------------------------------------------------------------- #
# Accepted connections (undirected edges)
# --------------------------------------------------------------------------- #
def insert_connection(user_a: str, user_b: str, created_at: str) -> None:
    pair = (user_a, user_b) if user_a < user_b else (user_b, user_a)
    conn = _connect()
    try:
        with conn:
            conn.execute(
                "INSERT OR IGNORE INTO connections (user_a, user_b, created_at)"
                " VALUES (?,?,?)",
                (pair[0], pair[1], created_at),
            )
    finally:
        conn.close()


def fetch_connections() -> List[Tuple[str, str]]:
    conn = _connect()
    try:
        rows = conn.execute("SELECT user_a, user_b FROM connections").fetchall()
    finally:
        conn.close()
    return [(row["user_a"], row["user_b"]) for row in rows]


def delete_connection(user_a: str, user_b: str) -> None:
    conn = _connect()
    try:
        with conn:
            conn.execute(
                "DELETE FROM connections WHERE (user_a=? AND user_b=?)"
                " OR (user_a=? AND user_b=?)",
                (user_a, user_b, user_b, user_a),
            )
    finally:
        conn.close()


# --------------------------------------------------------------------------- #
# Pending requests
# --------------------------------------------------------------------------- #
def insert_request(sender: str, receiver: str, created_at: str) -> int:
    """Insert a fresh pending request row; returns its id."""
    conn = _connect()
    try:
        with conn:
            cursor = conn.execute(
                "INSERT INTO requests (sender, receiver, status, created_at)"
                " VALUES (?,?,?,?)",
                (sender, receiver, connection_status.PENDING, created_at),
            )
            request_id = cursor.lastrowid
    finally:
        conn.close()
    return int(request_id)


def fetch_pending_requests() -> List[ConnectionRequest]:
    conn = _connect()
    try:
        rows = conn.execute(
            "SELECT * FROM requests WHERE status=? ORDER BY created_at",
            (connection_status.PENDING,),
        ).fetchall()
    finally:
        conn.close()
    return [
        ConnectionRequest(row["id"], row["sender"], row["receiver"],
                          row["status"], row["created_at"])
        for row in rows
    ]


def get_request(request_id: int):
    conn = _connect()
    try:
        row = conn.execute("SELECT * FROM requests WHERE id=?", (request_id,)).fetchone()
    finally:
        conn.close()
    if row is None:
        return None
    return ConnectionRequest(row["id"], row["sender"], row["receiver"],
                             row["status"], row["created_at"])


def delete_request(request_id: int) -> None:
    """Terminal states (accepted / rejected / cancelled) delete the row,
    keeping the table a pure queue of pending requests."""
    conn = _connect()
    try:
        with conn:
            conn.execute("DELETE FROM requests WHERE id=?", (request_id,))
    finally:
        conn.close()


# --------------------------------------------------------------------------- #
# Posts
# --------------------------------------------------------------------------- #
def insert_post(author: str, content: str, created_at: str,
                media_url: str = "", media_type: str = "") -> int:
    conn = _connect()
    try:
        with conn:
            cursor = conn.execute(
                "INSERT INTO posts (author, content, media_url, media_type,"
                " created_at) VALUES (?,?,?,?,?)",
                (author, content, media_url, media_type, created_at),
            )
            post_id = cursor.lastrowid
    finally:
        conn.close()
    return int(post_id)


def fetch_all_posts() -> List[Post]:
    conn = _connect()
    try:
        rows = conn.execute("SELECT * FROM posts ORDER BY id").fetchall()
    finally:
        conn.close()
    return [Post(row["id"], row["author"], row["content"], row["created_at"],
                 row["media_url"] or "", row["media_type"] or "")
            for row in rows]


def delete_post(post_id: int) -> None:
    """Delete a post together with its likes, comments and comment likes."""
    conn = _connect()
    try:
        with conn:
            conn.execute(
                "DELETE FROM comment_likes WHERE comment_id IN"
                " (SELECT id FROM comments WHERE post_id=?)",
                (post_id,),
            )
            conn.execute("DELETE FROM posts WHERE id=?", (post_id,))
            conn.execute("DELETE FROM likes WHERE post_id=?", (post_id,))
            conn.execute("DELETE FROM comments WHERE post_id=?", (post_id,))
    finally:
        conn.close()


# --------------------------------------------------------------------------- #
# Likes
# --------------------------------------------------------------------------- #
def insert_like(post_id: int, username: str, created_at: str) -> None:
    conn = _connect()
    try:
        with conn:
            conn.execute(
                "INSERT OR IGNORE INTO likes (post_id, username, created_at)"
                " VALUES (?,?,?)",
                (post_id, username, created_at),
            )
    finally:
        conn.close()


def delete_like(post_id: int, username: str) -> None:
    conn = _connect()
    try:
        with conn:
            conn.execute("DELETE FROM likes WHERE post_id=? AND username=?",
                         (post_id, username))
    finally:
        conn.close()


def fetch_likes() -> Dict[int, Set[str]]:
    """Returns hash table: post_id -> set of usernames who liked it."""
    conn = _connect()
    try:
        rows = conn.execute("SELECT post_id, username FROM likes").fetchall()
    finally:
        conn.close()
    likes: Dict[int, Set[str]] = {}
    for row in rows:
        likes.setdefault(row["post_id"], set()).add(row["username"])
    return likes


# --------------------------------------------------------------------------- #
# Comments + comment likes
# --------------------------------------------------------------------------- #
def insert_comment(post_id: int, author: str, content: str,
                   created_at: str, parent_id: int | None = None) -> int:
    conn = _connect()
    try:
        with conn:
            cursor = conn.execute(
                "INSERT INTO comments (post_id, author, content, created_at,"
                " parent_id) VALUES (?,?,?,?,?)",
                (post_id, author, content, created_at, parent_id),
            )
            comment_id = cursor.lastrowid
    finally:
        conn.close()
    return int(comment_id)


def fetch_comments() -> Dict[int, List[Comment]]:
    """Returns hash table: post_id -> chronological list of comments."""
    conn = _connect()
    try:
        rows = conn.execute("SELECT * FROM comments ORDER BY id").fetchall()
    finally:
        conn.close()
    grouped: Dict[int, List[Comment]] = {}
    for row in rows:
        # Older database files pre-date the parent_id column — treat those
        # rows as top-level comments.
        columns = set(row.keys())
        parent_id = row["parent_id"] if "parent_id" in columns else None
        grouped.setdefault(row["post_id"], []).append(
            Comment(row["id"], row["post_id"], row["author"],
                    row["content"], row["created_at"], parent_id)
        )
    return grouped


# --------------------------------------------------------------------------- #
# Comment likes
# --------------------------------------------------------------------------- #
def insert_comment_like(comment_id: int, username: str, created_at: str) -> None:
    conn = _connect()
    try:
        with conn:
            conn.execute(
                "INSERT OR IGNORE INTO comment_likes (comment_id, username,"
                " created_at) VALUES (?,?,?)",
                (comment_id, username, created_at),
            )
    finally:
        conn.close()


def delete_comment_like(comment_id: int, username: str) -> None:
    conn = _connect()
    try:
        with conn:
            conn.execute(
                "DELETE FROM comment_likes WHERE comment_id=? AND username=?",
                (comment_id, username),
            )
    finally:
        conn.close()


def fetch_comment_likes() -> Dict[int, Set[str]]:
    """Returns hash table: comment_id -> set of usernames who liked it."""
    conn = _connect()
    try:
        rows = conn.execute(
            "SELECT comment_id, username FROM comment_likes"
        ).fetchall()
    finally:
        conn.close()
    likes: Dict[int, Set[str]] = {}
    for row in rows:
        likes.setdefault(row["comment_id"], set()).add(row["username"])
    return likes


# --------------------------------------------------------------------------- #
# Notifications
# --------------------------------------------------------------------------- #
def insert_notification(recipient: str, kind: str, actor: str, message: str,
                        created_at: str) -> int:
    conn = _connect()
    try:
        with conn:
            cursor = conn.execute(
                "INSERT INTO notifications (recipient, kind, actor, message,"
                " is_read, created_at) VALUES (?,?,?,?,0,?)",
                (recipient, kind, actor, message, created_at),
            )
            notification_id = cursor.lastrowid
    finally:
        conn.close()
    return int(notification_id)


def fetch_all_notifications() -> List[Notification]:
    conn = _connect()
    try:
        rows = conn.execute(
            "SELECT * FROM notifications ORDER BY id"
        ).fetchall()
    finally:
        conn.close()
    return [
        Notification(row["id"], row["recipient"], row["kind"], row["actor"],
                     row["message"], bool(row["is_read"]), row["created_at"])
        for row in rows
    ]


def mark_all_notifications_read(recipient: str) -> None:
    conn = _connect()
    try:
        with conn:
            conn.execute(
                "UPDATE notifications SET is_read=1 WHERE recipient=?",
                (recipient,),
            )
    finally:
        conn.close()


# --------------------------------------------------------------------------- #
# Collaboration Hub
# --------------------------------------------------------------------------- #
def insert_collab(owner: str, title: str, description: str, category: str,
                  skills_needed: str, team_size: int, created_at: str) -> int:
    conn = _connect()
    try:
        with conn:
            cursor = conn.execute(
                "INSERT INTO collabs (owner, title, description, category,"
                " skills_needed, team_size, status, created_at)"
                " VALUES (?,?,?,?,?,?, 'open', ?)",
                (owner, title, description, category, skills_needed,
                 team_size, created_at),
            )
            collab_id = cursor.lastrowid
    finally:
        conn.close()
    return int(collab_id)


def fetch_collabs() -> List[Collab]:
    conn = _connect()
    try:
        rows = conn.execute("SELECT * FROM collabs ORDER BY id DESC").fetchall()
    finally:
        conn.close()
    return [
        Collab(
            id=row["id"], owner=row["owner"], title=row["title"],
            description=row["description"], category=row["category"],
            skills_needed=[s for s in row["skills_needed"].split(",") if s],
            team_size=row["team_size"], status=row["status"],
            created_at=row["created_at"],
        )
        for row in rows
    ]


def update_collab_status(collab_id: int, status: str) -> None:
    conn = _connect()
    try:
        with conn:
            conn.execute("UPDATE collabs SET status=? WHERE id=?", (status, collab_id))
    finally:
        conn.close()


def delete_collab(collab_id: int) -> None:
    """Remove a collaboration with its members and applications."""
    conn = _connect()
    try:
        with conn:
            conn.execute("DELETE FROM collab_applications WHERE collab_id=?", (collab_id,))
            conn.execute("DELETE FROM collab_members WHERE collab_id=?", (collab_id,))
            conn.execute("DELETE FROM collabs WHERE id=?", (collab_id,))
    finally:
        conn.close()


def insert_collab_member(collab_id: int, username: str, role: str,
                         joined_at: str) -> None:
    conn = _connect()
    try:
        with conn:
            conn.execute(
                "INSERT OR IGNORE INTO collab_members (collab_id, username, role,"
                " joined_at) VALUES (?,?,?,?)",
                (collab_id, username, role, joined_at),
            )
    finally:
        conn.close()


def fetch_collab_members() -> List[CollabMember]:
    conn = _connect()
    try:
        rows = conn.execute(
            "SELECT * FROM collab_members ORDER BY joined_at, username"
        ).fetchall()
    finally:
        conn.close()
    return [
        CollabMember(row["collab_id"], row["username"], row["role"], row["joined_at"])
        for row in rows
    ]


def insert_collab_application(collab_id: int, applicant: str, message: str,
                              created_at: str) -> int:
    conn = _connect()
    try:
        with conn:
            cursor = conn.execute(
                "INSERT INTO collab_applications (collab_id, applicant, message,"
                " created_at) VALUES (?,?,?,?)",
                (collab_id, applicant, message, created_at),
            )
            app_id = cursor.lastrowid
    finally:
        conn.close()
    return int(app_id)


def fetch_collab_applications() -> List[CollabApplication]:
    """Every pending join application (the table is a pure pending queue)."""
    conn = _connect()
    try:
        rows = conn.execute(
            "SELECT * FROM collab_applications ORDER BY id"
        ).fetchall()
    finally:
        conn.close()
    return [
        CollabApplication(row["id"], row["collab_id"], row["applicant"],
                          row["message"], "pending", row["created_at"])
        for row in rows
    ]


def delete_collab_application(app_id: int) -> None:
    """Terminal states (accepted / rejected) delete the pending row."""
    conn = _connect()
    try:
        with conn:
            conn.execute("DELETE FROM collab_applications WHERE id=?", (app_id,))
    finally:
        conn.close()


# --------------------------------------------------------------------------- #
# Project Showcase
# --------------------------------------------------------------------------- #
def insert_project(owner: str, title: str, description: str, cover_url: str,
                   tech_stack: str, github_url: str, demo_url: str,
                   category: str, created_at: str) -> int:
    conn = _connect()
    try:
        with conn:
            cursor = conn.execute(
                "INSERT INTO projects (owner, title, description, cover_url,"
                " tech_stack, github_url, demo_url, category, featured,"
                " created_at) VALUES (?,?,?,?,?,?,?,?,0,?)",
                (owner, title, description, cover_url, tech_stack,
                 github_url, demo_url, category, created_at),
            )
            project_id = cursor.lastrowid
    finally:
        conn.close()
    return int(project_id)


def fetch_projects() -> List[ShowcaseProject]:
    conn = _connect()
    try:
        rows = conn.execute("SELECT * FROM projects ORDER BY id DESC").fetchall()
    finally:
        conn.close()
    return [
        ShowcaseProject(
            id=row["id"], owner=row["owner"], title=row["title"],
            description=row["description"], cover_url=row["cover_url"] or "",
            tech_stack=[s for s in row["tech_stack"].split(",") if s],
            github_url=row["github_url"], demo_url=row["demo_url"],
            category=row["category"], featured=bool(row["featured"]),
            created_at=row["created_at"],
        )
        for row in rows
    ]


def update_project(project_id: int, title: str, description: str,
                   cover_url: str, tech_stack: str, github_url: str,
                   demo_url: str, category: str) -> None:
    conn = _connect()
    try:
        with conn:
            conn.execute(
                "UPDATE projects SET title=?, description=?, cover_url=?,"
                " tech_stack=?, github_url=?, demo_url=?, category=? WHERE id=?",
                (title, description, cover_url, tech_stack, github_url,
                 demo_url, category, project_id),
            )
    finally:
        conn.close()


def set_project_featured(project_id: int, featured: bool) -> None:
    conn = _connect()
    try:
        with conn:
            conn.execute("UPDATE projects SET featured=? WHERE id=?",
                         (1 if featured else 0, project_id))
    finally:
        conn.close()


def delete_project(project_id: int) -> None:
    conn = _connect()
    try:
        with conn:
            conn.execute("DELETE FROM project_contributors WHERE project_id=?",
                         (project_id,))
            conn.execute("DELETE FROM projects WHERE id=?", (project_id,))
    finally:
        conn.close()


def insert_project_contributor(project_id: int, username: str,
                               added_at: str) -> None:
    conn = _connect()
    try:
        with conn:
            conn.execute(
                "INSERT OR IGNORE INTO project_contributors (project_id,"
                " username, added_at) VALUES (?,?,?)",
                (project_id, username, added_at),
            )
    finally:
        conn.close()


def fetch_project_contributors() -> List[ProjectContributor]:
    conn = _connect()
    try:
        rows = conn.execute(
            "SELECT * FROM project_contributors ORDER BY added_at, username"
        ).fetchall()
    finally:
        conn.close()
    return [
        ProjectContributor(row["project_id"], row["username"], row["added_at"])
        for row in rows
    ]


def delete_project_contributor(project_id: int, username: str) -> None:
    conn = _connect()
    try:
        with conn:
            conn.execute(
                "DELETE FROM project_contributors WHERE project_id=? AND username=?",
                (project_id, username),
            )
    finally:
        conn.close()
