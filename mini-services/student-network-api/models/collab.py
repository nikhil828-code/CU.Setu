"""Collaboration Hub models — project ideas, members, join applications."""

from dataclasses import dataclass, field
from typing import List


@dataclass
class Collab:
    """A posted project idea looking for team members."""
    id: int
    owner: str
    title: str
    description: str = ""
    category: str = "General"
    skills_needed: List[str] = field(default_factory=list)
    team_size: int = 4
    status: str = "open"          # open | closed
    created_at: str = ""


@dataclass
class CollabMember:
    """One student on a collaboration team (owner or member)."""
    collab_id: int
    username: str
    role: str = "member"          # owner | member
    joined_at: str = ""


@dataclass
class CollabApplication:
    """A pending request to join a collaboration."""
    id: int
    collab_id: int
    applicant: str
    message: str = ""
    status: str = "pending"       # pending (the queue holds pending only)
    created_at: str = ""
