"""
Post, Comment and Notification models.

Posts live in a list at the service layer; the FEED orders them through the
dsa.heap priority queue (newest first) rather than trusting insertion order.
Likes are stored as a hash table  post_id -> set(usernames)  so "did I like
this?" is an O(1) membership test. Comments are grouped per post in
insertion (chronological) order — the same FIFO guarantee the Queue class
provides conceptually.
"""

from typing import List


class Post:
    """A text post shared by a student."""

    __slots__ = ("id", "author", "content", "created_at")

    def __init__(self, post_id: int, author: str, content: str,
                 created_at: str = "") -> None:
        self.id = post_id
        self.author = author
        self.content = content
        self.created_at = created_at


class Comment:
    """A comment on a post (chronological order per post)."""

    __slots__ = ("id", "post_id", "author", "content", "created_at")

    def __init__(self, comment_id: int, post_id: int, author: str,
                 content: str, created_at: str = "") -> None:
        self.id = comment_id
        self.post_id = post_id
        self.author = author
        self.content = content
        self.created_at = created_at


class Notification:
    """A notification delivered to one student.

    kinds: request_received | request_accepted | request_rejected |
           post_liked | post_commented
    New notifications are ENQUEUED (FIFO); the notification page reads them
    newest-first.
    """

    __slots__ = ("id", "recipient", "kind", "actor", "message",
                 "is_read", "created_at")

    def __init__(self, notification_id: int, recipient: str, kind: str,
                 actor: str, message: str, is_read: bool = False,
                 created_at: str = "") -> None:
        self.id = notification_id
        self.recipient = recipient
        self.kind = kind
        self.actor = actor
        self.message = message
        self.is_read = is_read
        self.created_at = created_at
