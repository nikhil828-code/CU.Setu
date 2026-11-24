"""
Graph-based recommendations — the "People You May Know" engine.

The idea
--------
A social network's best recommendation signal is the graph itself. We score
every eligible candidate with a transparent, explainable formula:

    score = 3.0 * mutual_connection_count            (strongest signal)
          + 4.0 * jaccard(my connections, their connections)
          + 1.5 * shared technical skills          (capped at 4 skills)
          + 1.0 * shared interests                 (capped at 4 interests)
          + 2.0   if same academic programme
          + 1.0   if same year of study

Jaccard similarity
------------------
    J(A, B) = |A ∩ B| / |A ∪ B|   ("what fraction of the combined
    neighbourhood do these two students share?")

It normalises for degree: sharing 3 friends means a lot if you each have 5
connections, and little if you each have 200.

Eligibility (who is even considered)
------------------------------------
Excluded: yourself, direct connections, and anyone with a PENDING request
in either direction (you cannot send a second one anyway).

Ranking uses dsa.heap.top_k — a bounded heap of size K — so we never fully
sort the candidate list, exactly like production recommender systems do.

The result adapts naturally to the viewer: a student with a rich network is
recommended through mutuals and Jaccard; a brand-new student falls back to
programme / skills / interests similarity.
"""

from typing import Dict, List

from .graph import SocialGraph
from .heap import top_k


def jaccard_similarity(set_a: set, set_b: set) -> float:
    """Jaccard similarity of two sets: intersection size / union size."""
    union = set_a | set_b
    if not union:
        return 0.0
    return len(set_a & set_b) / len(union)


def people_you_may_know(
    graph: SocialGraph,
    user: str,
    profiles: Dict[str, dict],
    limit: int = 10,
) -> List[dict]:
    """Rank and return the best `limit` connection candidates for `user`.

    Parameters
    ----------
    graph    : the SocialGraph (adjacency lists)
    user     : username of the viewer
    profiles: hash table username -> {programme, year, skills, interests}
    limit    : how many recommendations to return (the K of top-K)
    """
    me = profiles.get(user, {})
    my_neighbors = graph.neighbors(user)
    my_skills = {s.lower() for s in me.get("skills", [])}
    my_interests = {i.lower() for i in me.get("interests", [])}
    my_programme = me.get("programme") or ""
    my_year = me.get("year") or ""

    scored = []
    for candidate in graph.vertices():
        # -- eligibility ------------------------------------------------ #
        if candidate == user:
            continue                          # never recommend yourself
        if candidate in my_neighbors:
            continue                          # already connected
        if graph.pending_direction(user, candidate):
            continue                          # pending request either way

        their = profiles.get(candidate, {})
        their_skills = {s.lower() for s in their.get("skills", [])}
        their_interests = {i.lower() for i in their.get("interests", [])}

        # -- scoring ---------------------------------------------------- #
        mutual = graph.mutual(user, candidate)     # set intersection
        shared_skills = sorted(my_skills & their_skills)
        shared_interests = sorted(my_interests & their_interests)
        same_programme = bool(my_programme) and my_programme == (their.get("programme") or "")
        same_year = bool(my_year) and my_year == (their.get("year") or "")

        score = (
            3.0 * len(mutual)
            + 4.0 * jaccard_similarity(my_neighbors, graph.neighbors(candidate))
            + 1.5 * min(len(shared_skills), 4)
            + 1.0 * min(len(shared_interests), 4)
            + (2.0 if same_programme else 0.0)
            + (1.0 if same_year else 0.0)
        )

        scored.append(
            (
                score,
                {
                    "username": candidate,
                    "mutual_count": len(mutual),
                    "mutual_names": sorted(mutual)[:5],   # for UI avatars
                    "shared_skills": shared_skills[:6],
                    "shared_interests": shared_interests[:6],
                    "same_programme": same_programme,
                    "same_year": same_year,
                    "score": round(score, 2),
                },
            )
        )

    # Top-K selection with a bounded heap, returned best-first.
    return [info for _, info in top_k(scored, limit)]
