"""
Trie (prefix tree) — powers the live student search.

The problem: as soon as a user types the first letters of a name we must
show matching students instantly. Scanning every student name on every
keystroke is O(n * L). A trie answers "which keywords start with 'an?'"
in O(P + M) where P = prefix length and M = size of the matched subtree —
independent of how many students exist.

What we insert
--------------
For every student we insert (lower-cased):
    - their username                ("aarav")
    - every word of their full name ("aarav", "sharma")
Each node keeps the SET of usernames whose keyword ends there, so a prefix
hit immediately tells us WHO matched — no second pass needed.

Structure (after inserting "ananya", "ananya das", "aarav"):
                       root
                       /  \\
                      a    s ...
                      |
                      n
                      |
                      a ─── (aarav)
                     /|\\
                    v ... (ananya) ── d ── a ── s ── (ananya das)
"""


class TrieNode:
    """One node of the trie. `children` is a hash table char -> TrieNode,
    and `usernames` holds students whose keyword terminates at this node."""

    __slots__ = ("children", "usernames")

    def __init__(self) -> None:
        self.children = {}   # char -> TrieNode
        self.usernames = set()  # non-empty  =>  a keyword ends here


class Trie:
    def __init__(self) -> None:
        self.root = TrieNode()

    # ------------------------------------------------------------------ #
    # Insertion / deletion
    # ------------------------------------------------------------------ #
    def insert(self, text: str, username: str) -> None:
        """Add one keyword (a username or one word of a full name) pointing
        to the student who owns it.  O(L), L = length of the keyword."""
        text = text.strip().lower()
        if not text:
            return
        node = self.root
        for char in text:
            if char not in node.children:
                node.children[char] = TrieNode()
            node = node.children[char]
        node.usernames.add(username)

    def remove(self, text: str, username: str) -> None:
        """Remove `username` from the terminal node of `text`, then PRUNE
        any chain of nodes left empty above it — keeps the trie compact
        when profiles are edited.  O(L)"""
        text = text.strip().lower()
        if not text:
            return
        # Walk down remembering (parent, char, node) so we can prune upward.
        trail = []  # list of (parent, char, node)
        node = self.root
        for char in text:
            if char not in node.children:
                return                      # keyword was never inserted
            trail.append((node, char, node.children[char]))
            node = node.children[char]
        node.usernames.discard(username)
        # Delete now-empty branches from the bottom up.
        for parent, char, current in reversed(trail):
            if not current.usernames and not current.children:
                del parent.children[char]
            else:
                break                       # node still used, stop pruning

    # ------------------------------------------------------------------ #
    # Prefix search
    # ------------------------------------------------------------------ #
    def prefix_matches(self, prefix: str, limit: int = 20) -> list:
        """All usernames whose username or name-word starts with `prefix`.

        O(P + M):  P = prefix length to walk down, then M = collect the
        usernames stored in the whole subtree under that node.
        Case-insensitive; unknown prefix returns [] instantly.
        """
        prefix = prefix.strip().lower()
        if not prefix:
            return []
        node = self.root
        for char in prefix:
            if char not in node.children:
                return []                   # prefix diverges -> no matches
            node = node.children[char]
        matches = set()
        self._collect(node, matches)
        usernames = sorted(matches)
        return usernames[:limit] if limit else usernames

    def _collect(self, node: TrieNode, out: set) -> None:
        """Depth-first collection of every username in this subtree."""
        out.update(node.usernames)
        for child in node.children.values():
            self._collect(child, out)
