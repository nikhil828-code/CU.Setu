"""
DSA Playground trace generators — every visualiser runs the REAL module.

The five classics of the course, replayed step by step against genuine
platform data:

    graph     SocialGraph (adjacency lists)  — the student network itself
    bfs       dsa.bfs.bfs_trace             — the animated traversal
    trie      dsa.trie.Trie                 — the live search index
    heap      dsa.heap.MinHeap              — instrumented with on_swap
    hashmap   a hash table of skill counts   — the analytics counter

Each generator returns a list of steps the frontend animates. The steps are
recorded WHILE the algorithm runs — nothing is faked or pre-computed
cosmetically.
"""

from typing import Dict, List, Optional, Tuple

from .bfs import bfs_trace
from .graph import SocialGraph
from .heap import MinHeap
from .trie import Trie, TrieNode

__all__ = [
    "bfs_trace",
    "graph_build_trace",
    "heap_trace",
    "hashmap_trace",
    "trie_insert_trace",
    "trie_serialize",
    "trie_search_trace",
]


# --------------------------------------------------------------------------- #
# Graph — how the student network is assembled
# --------------------------------------------------------------------------- #
def graph_build_trace(graph: SocialGraph, students: List[str]) -> List[dict]:
    """Steps: register every student vertex, then connect every accepted edge."""
    steps: List[dict] = []
    for username in sorted(students):
        steps.append({"op": "add_vertex", "node": username})
    for user_a, user_b in graph.edge_pairs():
        steps.append({"op": "add_edge", "source": user_a, "target": user_b})
    return steps


# --------------------------------------------------------------------------- #
# Trie — the prefix search index being built + queried
# --------------------------------------------------------------------------- #
def trie_insert_trace(words: List[Tuple[str, str]]) -> Tuple[Trie, List[dict]]:
    """Insert every (word, owner) into a fresh Trie, one character per step.

    Returns the built trie plus the animation trace:
        start_word  -> a new keyword begins
        create      -> a brand-new child node is born for this character
        descend     -> an existing child node is reused
        finish_word -> the keyword is registered for its owner
    """
    trie = Trie()
    node = trie.root
    steps: List[dict] = []
    for word, owner in words:
        node = trie.root
        steps.append({"op": "start_word", "word": word, "owner": owner})
        for index, char in enumerate(word):
            if char in node.children:
                steps.append({"op": "descend", "word": word, "index": index,
                              "char": char})
                node = node.children[char]
            else:
                steps.append({"op": "create", "word": word, "index": index,
                              "char": char})
                node.children[char] = TrieNode()
                node = node.children[char]
        node.usernames.add(owner)
        steps.append({"op": "finish_word", "word": word, "owner": owner,
                      "index": len(word) - 1})
    return trie, steps


def trie_serialize(root: TrieNode) -> dict:
    """The trie as nested JSON for SVG rendering: {char, terminal, children}."""
    def node_json(node: TrieNode, char: str) -> dict:
        return {
            "char": char,
            "terminal": sorted(node.usernames),
            "children": [node_json(node.children[c], c)
                         for c in sorted(node.children)],
        }
    return node_json(root, "")


def trie_search_trace(trie: Trie, prefix: str) -> Tuple[List[dict], List[str]]:
    """Walk the prefix character by character, then collect matches.

    The final matches come from the real Trie.prefix_matches — the same
    call the live search box makes.
    """
    prefix = prefix.strip().lower()
    steps: List[dict] = []
    node = trie.root
    for index, char in enumerate(prefix):
        if char in node.children:
            node = node.children[char]
            steps.append({"op": "match", "index": index, "char": char})
        else:
            steps.append({"op": "miss", "index": index, "char": char})
            return steps, []
    matches = trie.prefix_matches(prefix)
    steps.append({"op": "collect", "prefix": prefix, "matches": matches[:20]})
    return steps, matches[:20]


# --------------------------------------------------------------------------- #
# Heap — a real MinHeap, swaps recorded by the on_swap instrument
# --------------------------------------------------------------------------- #
def heap_trace(values: List[Tuple[str, float]]) -> List[dict]:
    """Push every (label, priority) into a live MinHeap — each sift-up swap
    is recorded — then pop them all back out, recording the sift-downs.

    Popping a min-heap yields ascending order: the animation literally
    IS the priority-queue ordering used for the feed and top-K rankings.
    """
    steps: List[dict] = []

    def on_swap(i: int, j: int) -> None:
        # 'heap' is resolved at call time — the instrument fires only
        # during push/pop, after the heap exists.
        steps.append({
            "op": "swap",
            "i": i, "j": j,
            "labels": [item[0] for item in heap.snapshot()],
            "values": [item[1] for item in heap.snapshot()],
        })

    heap = MinHeap(key=lambda item: item[1], on_swap=on_swap)

    for label, value in values:
        steps.append({
            "op": "push", "label": label, "value": value,
            "note": f"append at index {len(heap)} then sift up",
        })
        heap.push((label, value))
        steps.append({
            "op": "state",
            "labels": [item[0] for item in heap.snapshot()],
            "values": [item[1] for item in heap.snapshot()],
        })

    for _ in range(len(heap)):
        root = heap.peek()
        steps.append({
            "op": "pop_min", "label": root[0], "value": root[1],
            "note": "the root is the smallest priority",
        })
        heap.pop()
        steps.append({
            "op": "state",
            "labels": [item[0] for item in heap.snapshot()],
            "values": [item[1] for item in heap.snapshot()],
        })
    return steps


# --------------------------------------------------------------------------- #
# Hash map — skill counting with visible buckets
# --------------------------------------------------------------------------- #
def _snapshot_table(table: List[List]) -> List[List]:
    return [[list(entry) for entry in bucket] for bucket in table]


def hashmap_trace(profiles: Dict[str, dict], capacity: int = 8) -> dict:
    """Count every student's skills into an open-hashing table.

    hash(key) = (sum of character codes) mod capacity  — visible and
    explainable. Collisions chain inside the same bucket, exactly like
    separate chaining in a hash-map course diagram.
    """
    table: List[List[List]] = [[] for _ in range(capacity)]
    counts: Dict[str, int] = {}
    steps: List[dict] = []

    def bucket_of(key: str) -> int:
        return sum(ord(ch) for ch in key) % capacity

    for username in sorted(profiles):
        for skill in profiles[username].get("skills", []):
            key = skill.strip().lower()
            if not key:
                continue
            bucket = bucket_of(key)
            steps.append({
                "op": "hash", "key": key, "owner": username, "bucket": bucket,
                "detail": f"sum of character codes of '{key}' mod {capacity}",
            })
            entry = next((e for e in table[bucket] if e[0] == key), None)
            if entry is not None:
                entry[1] += 1
                steps.append({
                    "op": "increment", "key": key, "bucket": bucket,
                    "count": entry[1],
                    "table": _snapshot_table(table),
                })
            else:
                table[bucket].append([key, 1])
                steps.append({
                    "op": "insert", "key": key, "bucket": bucket,
                    "table": _snapshot_table(table),
                })
            counts[key] = counts.get(key, 0) + 1

    return {
        "capacity": capacity,
        "steps": steps,
        "table": _snapshot_table(table),
        "counts": dict(sorted(counts.items(), key=lambda kv: -kv[1])),
    }
