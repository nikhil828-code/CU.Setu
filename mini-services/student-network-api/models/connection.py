"""
Connection request model.

A connection request travels through a small state machine:

        pending ──(receiver accepts)──> accepted  -> becomes an undirected edge
        pending ──(receiver rejects)──> rejected  -> never becomes an edge
        pending ──(sender cancels)────> cancelled -> never becomes an edge

Only PENDING requests are mirrored into the in-memory graph (as directed
edges) and into the pending-requests queue — accepted ones graduate into
undirected edges, rejected/cancelled ones simply disappear.
"""

PENDING = "pending"
ACCEPTED = "accepted"
REJECTED = "rejected"
CANCELLED = "cancelled"


class ConnectionRequest:
    """A pending connection request: directed edge sender -> receiver."""

    __slots__ = ("id", "sender", "receiver", "status", "created_at")

    def __init__(self, request_id: int, sender: str, receiver: str,
                 status: str = PENDING, created_at: str = "") -> None:
        self.id = request_id
        self.sender = sender
        self.receiver = receiver
        self.status = status
        self.created_at = created_at

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "sender": self.sender,
            "receiver": self.receiver,
            "status": self.status,
            "created_at": self.created_at,
        }
