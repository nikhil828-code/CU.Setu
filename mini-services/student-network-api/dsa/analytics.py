"""
Campus Skill Analytics — hash-map counting + heap ranking + set comparisons.

Where each classic data structure earns its keep
--------------------------------------------------
    HASH MAP   skill -> number of students who have it   (the counter)
    HEAP       top-K ranking of the most popular skills  (priority queue)
    SETS       co-occurrence / complementary skills      (set intersection)

Everything is computed from the live student profiles — nothing hardcoded.
"""

from typing import Dict, List

from .heap import top_k
from .matching import build_skill_index


def skill_counts(profiles: Dict[str, dict]) -> Dict[str, int]:
    """The hash-map counter: skill -> how many students listed it."""
    counts: Dict[str, int] = {}
    for profile in profiles.values():
        for skill in profile.get("skills", []):
            normalized = skill.strip().lower()
            if normalized:
                counts[normalized] = counts.get(normalized, 0) + 1
    return counts


def top_skills(counts: Dict[str, int], k: int = 10) -> List[dict]:
    """Most popular skills via the bounded top-K heap."""
    scored = [(count, {"skill": skill, "count": count})
              for skill, count in counts.items()]
    return [info for _, info in top_k(scored, k)]


def group_distribution(profiles: Dict[str, dict], group_key: str) -> Dict[str, List[dict]]:
    """Per-group (programme / year) skill popularity — a nested hash map of
    counters, each ranked with its own top-K heap."""
    grouped: Dict[str, Dict[str, int]] = {}
    for profile in profiles.values():
        group = (profile.get(group_key) or "").strip()
        if not group:
            group = "Unspecified"
        bucket = grouped.setdefault(group, {})
        for skill in profile.get("skills", []):
            normalized = skill.strip().lower()
            if normalized:
                bucket[normalized] = bucket.get(normalized, 0) + 1
    return {group: top_skills(counts, 8) for group, counts in sorted(grouped.items())}


def students_with_skill(profiles: Dict[str, dict], skill: str) -> List[str]:
    """The inverted index (hash of skill -> set of students) answers 'who
    knows X?' without scanning any profile."""
    index = build_skill_index(profiles)
    return sorted(index.get(skill.strip().lower(), set()))


def complementary_skills(profiles: Dict[str, dict], target: str,
                         k: int = 8) -> List[dict]:
    """Skills that most often ACCOMPANY the target skill.

    For every student who has the target skill, collect their OTHER skills
    (set difference); count those co-occurrences; rank with the heap. The
    result is the 'pairs well with' recommendation for skill planners.
    """
    target = target.strip().lower()
    if not target:
        return []
    co_counts: Dict[str, int] = {}
    owners = 0
    for profile in profiles.values():
        skills = {s.strip().lower() for s in profile.get("skills", []) if s.strip()}
        if target in skills:
            owners += 1
            for other in skills - {target}:
                co_counts[other] = co_counts.get(other, 0) + 1
    scored = [(count, {"skill": other, "count": count})
              for other, count in co_counts.items()]
    ranked = [info for _, info in top_k(scored, k)]
    for info in ranked:
        info["of_owners"] = owners
        info["pct"] = round(100 * info["count"] / owners, 1) if owners else 0
    return ranked
