"""
Skill matching for the Collaboration Hub — who should join this team?

The classic production pipeline, in three DSA steps:

1. HASH INDEX.  Build a hash table  skill -> set(students who have it).
   One pass over every profile — O(total skills).  Exactly how an inverted
   index works, and the reason "who knows React?" never scans every
   student again afterwards.

2. SET MATCHING.  For each candidate, intersect their skill set with the
   project's skills-needed set.  Coverage = |intersection| / |needed| —
   a percentage, so a 4-skill project that matches 2 reads as 50%.

3. PRIORITY QUEUE RANKING.  Scores go into the bounded top-K heap
   (dsa.heap) — the same MinHeap that ranks recommendations and the feed.
   Candidates come back best-first without ever fully sorting the class.

Deliberately framework-free so it can be unit-tested for the viva.
"""

from typing import Dict, List

from .heap import top_k


def build_skill_index(profiles: Dict[str, dict]) -> Dict[str, set]:
    """Inverted index  skill -> {usernames having that skill}.

    profiles: hash table username -> {"skills": [...], ...}
    """
    index: Dict[str, set] = {}
    for username, profile in profiles.items():
        for skill in profile.get("skills", []):
            normalized = skill.strip().lower()
            if normalized:
                index.setdefault(normalized, set()).add(username)
    return index


def rank_candidates(
    skills_needed: List[str],
    profiles: Dict[str, dict],
    exclude: set,
    limit: int = 10,
) -> List[dict]:
    """Best students for a project, ranked by skill coverage.

    skills_needed : the project's wanted skills
    profiles      : username -> {"skills": [...], "interests": [...],
                                 "programme": str, ...}
    exclude       : usernames never to suggest (owner, existing members,
                    students with a pending application already in)
    limit         : size of the top-K heap
    """
    needed = {s.strip().lower() for s in skills_needed if s and s.strip()}
    if not needed:
        return []

    scored = []
    for username, profile in profiles.items():
        if username in exclude:
            continue
        theirs = {s.strip().lower() for s in profile.get("skills", [])}
        shared = needed & theirs
        coverage = len(shared) / len(needed)          # set matching ratio
        # tiny tie-breaker: absolute overlap rewards candidates who also
        # bring adjacent skills (bigger sets, same overlap)
        score = coverage + 0.01 * len(shared)
        if score <= 0:
            continue
        scored.append((score, {
            "username": username,
            "shared_skills": sorted(shared),
            "coverage": round(coverage, 3),
        }))

    # Priority-queue top-K selection, best-first.
    return [info for _, info in top_k(scored, limit)]
