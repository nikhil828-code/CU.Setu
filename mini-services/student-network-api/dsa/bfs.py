"""
Breadth-First Search (BFS) over the student SocialGraph.

Why BFS?
--------
BFS explores a graph LEVEL BY LEVEL: first the start node, then everyone
1 hop away, then everyone 2 hops away, and so on. Because every edge has the
same "cost" (1 hop), BFS is *guaranteed* to reach any vertex through the
SHORTEST number of intermediate connections. That is exactly what
"How are A and B connected?" means on a social network.

The frontier (nodes discovered but not yet expanded) is our own
dsa.queue.LinkedQueue — the textbook FIFO queue — which is what makes the
search breadth-first instead of depth-first.

Complexity: O(V + E) time, O(V) memory.
"""

from typing import Dict, List, Optional, Tuple

from .graph import SocialGraph
from .queue import LinkedQueue


def bfs_levels(graph: SocialGraph, source: str) -> Dict[str, int]:
    """Return {username: hops_from_source} for EVERY student reachable from
    `source`. The level number IS the degree of separation.

    Example (aarav's levels):
        {"aarav": 0, "ishita": 1, "priya": 1, "meera": 2, "tara": 2, ...}
    """
    levels = {source: 0}
    frontier = LinkedQueue()
    frontier.enqueue(source)

    while frontier:                              # LinkedQueue.__bool__
        current = frontier.dequeue()             # FIFO -> level by level
        for neighbor in sorted(graph.neighbors(current)):
            if neighbor not in levels:            # not discovered yet
                levels[neighbor] = levels[current] + 1
                frontier.enqueue(neighbor)
    return levels


def shortest_path(graph: SocialGraph, source: str, target: str) -> Optional[List[str]]:
    """Shortest connection path between two students, as a list of usernames
    [source, ..., target]. Returns None when they are not connected through
    anyone.

    Algorithm: plain BFS with a PARENT MAP.
        parent["vikram"] = "rohan"   means we first discovered vikram
        while expanding rohan.
    Walking the parent chain backwards from the target and reversing it
    rebuilds the path. Because BFS discovers nodes level by level, the first
    time we touch the target is necessarily via a shortest path.
    """
    if source == target:
        return [source]

    parent = {source: None}
    frontier = LinkedQueue()
    frontier.enqueue(source)

    while frontier:
        current = frontier.dequeue()
        if current == target:                    # reached — rebuild path
            path: List[str] = []
            while current is not None:
                path.append(current)
                current = parent[current]
            return path[::-1]                    # reverse: source -> target
        for neighbor in sorted(graph.neighbors(current)):
            if neighbor not in parent:
                parent[neighbor] = current
                frontier.enqueue(neighbor)
    return None                                   # no path exists


def connection_degrees(
    graph: SocialGraph, user: str
) -> Tuple[Dict[int, set], set]:
    """Classify every student reachable from `user` into degree buckets.

    Returns ({1: {...}, 2: {...}, 3: {...}}, beyond_set)

        1st degree = direct connections          (level 1)
        2nd degree = connections of connections  (level 2)
        3rd degree = one more hop out             (level 3)
        beyond    = level 4 or deeper (still reported as "3+")
    """
    buckets = {1: set(), 2: set(), 3: set()}
    beyond: set = set()
    for username, level in bfs_levels(graph, user).items():
        if username == user:
            continue
        if level == 1:
            buckets[1].add(username)
        elif level == 2:
            buckets[2].add(username)
        elif level == 3:
            buckets[3].add(username)
        elif level > 3:
            beyond.add(username)
    return buckets, beyond


def bfs_visit_order(graph: SocialGraph, source: str) -> List[str]:
    """The exact order BFS visits vertices — handy for demos and tests."""
    order: List[str] = []
    seen = {source}
    frontier = LinkedQueue()
    frontier.enqueue(source)
    while frontier:
        current = frontier.dequeue()
        order.append(current)
        for neighbor in sorted(graph.neighbors(current)):
            if neighbor not in seen:
                seen.add(neighbor)
                frontier.enqueue(neighbor)
    return order
