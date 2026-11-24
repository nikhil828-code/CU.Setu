"""
SocialGraph — the graph data structure behind the entire networking system.

How the student network is modelled
-----------------------------------
    every student              = a VERTEX (labelled by unique username)
    every accepted connection  = an UNDIRECTED edge  (stored in BOTH adjacency lists)
    every pending request      = a DIRECTED edge sender -> receiver
    rejected requests          = never become graph edges

Storage: adjacency lists
-----------------------
Instead of an N x N matrix (O(V^2) memory), each vertex stores only the set
of vertices it is connected to:

    _adj["aarav"] = {"ishita", "rohan", "sneha", "farah", "priya"}

The adjacency list itself is a hash table (Python dict: username -> set) which
gives us, for free:

    - O(1)  "does this student exist?"        (vertex lookup)
    - O(1)  "are these two connected?"        (edge membership test)
    - O(1)  add / remove an edge
    - O(deg)  iterate a student's connections

Pending requests live in two small hash tables (one keyed by sender, one by
receiver) so both "requests I sent" and "requests I received" are O(1) to
answer — that IS the queue of pending requests in graph form.
"""

from collections import defaultdict


class SocialGraph:
    """Adjacency-list graph of students, connections, and pending requests."""

    def __init__(self) -> None:
        # Accepted connections: username -> set of neighbour usernames.
        self._adj = defaultdict(set)

        # Pending (directed) requests.
        self._pending_out = defaultdict(set)  # sender  -> {receivers}
        self._pending_in = defaultdict(set)    # receiver -> {senders}

    # ====================================================================== #
    # Vertices
    # ====================================================================== #
    def add_vertex(self, username: str) -> None:
        """Register a student as a vertex. Creating the key in the hash
        table automatically gives them an empty adjacency set."""
        self._adj[username]
        self._pending_out[username]
        self._pending_in[username]

    def has_vertex(self, username: str) -> bool:
        """O(1) — hash table lookup."""
        return username in self._adj

    def vertices(self) -> set:
        """All student usernames in the graph."""
        return set(self._adj.keys())

    # ====================================================================== #
    # Accepted connections = undirected edges
    # ====================================================================== #
    def add_edge(self, user_a: str, user_b: str) -> None:
        """Record an accepted connection.

        An accepted connection is UNDIRECTED, so the edge is inserted into
        BOTH adjacency sets. Duplicate and self connections are refused here
        so the graph invariants are protected at the lowest level.
        """
        if user_a == user_b:
            raise ValueError("A student cannot connect to themselves.")
        if user_b in self._adj[user_a]:
            raise ValueError(f"{user_a} and {user_b} are already connected.")
        self._adj[user_a].add(user_b)
        self._adj[user_b].add(user_a)

    def remove_edge(self, user_a: str, user_b: str) -> None:
        """Disconnect two students (removes the undirected edge)."""
        self._adj[user_a].discard(user_b)
        self._adj[user_b].discard(user_a)

    def is_connected(self, user_a: str, user_b: str) -> bool:
        """O(1) edge membership test thanks to the hash sets."""
        return user_b in self._adj[user_a]

    def neighbors(self, username: str) -> set:
        """First-degree connections of a student (their adjacency list)."""
        return set(self._adj[username])

    def degree(self, username: str) -> int:
        """Graph degree of a vertex = number of direct connections."""
        return len(self._adj[username])

    # ====================================================================== #
    # Pending requests = directed edges
    # ====================================================================== #
    def add_pending(self, sender: str, receiver: str) -> None:
        """A new connection request is a DIRECTED edge sender -> receiver."""
        if sender == receiver:
            raise ValueError("A student cannot send a request to themselves.")
        if receiver in self._adj[sender]:
            raise ValueError(f"{sender} and {receiver} are already connected.")
        self._pending_out[sender].add(receiver)
        self._pending_in[receiver].add(sender)

    def remove_pending(self, sender: str, receiver: str) -> None:
        """Delete a pending directed edge (after accept / reject / cancel)."""
        self._pending_out[sender].discard(receiver)
        self._pending_in[receiver].discard(sender)

    def pending_direction(self, user_a: str, user_b: str):
        """Relationship state of a pending request between two students.

        Returns 'out' if a sent a request to b,
                'in'  if b sent a request to a,
                None   if there is no pending request between them.
        """
        if user_b in self._pending_out[user_a]:
            return "out"
        if user_b in self._pending_in[user_a]:
            return "in"
        return None

    def pending_outgoing(self, username: str) -> set:
        """Students this user has SENT a pending request to."""
        return set(self._pending_out[username])

    def pending_incoming(self, username: str) -> set:
        """students this user has RECEIVED a pending request from."""
        return set(self._pending_in[username])

    # ====================================================================== #
    # Analytic helpers
    # ====================================================================== #
    def mutual(self, user_a: str, user_b: str) -> set:
        """Mutual connections = SET INTERSECTION of two adjacency sets.

        Cost: O(min(deg(a), deg(b))) — Python intersects the smaller set first.
        This is the classic "mutual friends" computation of social networks.
        """
        return self._adj[user_a] & self._adj[user_b]

    def edge_count(self) -> int:
        """Number of accepted (undirected) edges in the whole graph."""
        return sum(len(friends) for friends in self._adj.values()) // 2

    def edge_pairs(self) -> list:
        """Canonical (a, b) pairs with a < b — used when persisting the graph
        to SQLite. Each undirected edge appears exactly once."""
        pairs, seen = [], set()
        for user, friends in self._adj.items():
            for friend in friends:
                pair = (user, friend) if user < friend else (friend, user)
                if pair not in seen:
                    seen.add(pair)
                    pairs.append(pair)
        return pairs
