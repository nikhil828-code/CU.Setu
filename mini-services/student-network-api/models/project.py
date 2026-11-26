"""Project Showcase models — published projects and their contributors."""

from dataclasses import dataclass, field
from typing import List


@dataclass
class ShowcaseProject:
    """A published student project for the showcase."""
    id: int
    owner: str
    title: str
    description: str = ""
    cover_url: str = ""             # uploaded cover image URL
    tech_stack: List[str] = field(default_factory=list)
    github_url: str = ""
    demo_url: str = ""
    category: str = "General"
    featured: bool = False           # owner-toggled spotlight
    created_at: str = ""


@dataclass
class ProjectContributor:
    """A credited contributor on a showcase project."""
    project_id: int
    username: str
    added_at: str = ""
