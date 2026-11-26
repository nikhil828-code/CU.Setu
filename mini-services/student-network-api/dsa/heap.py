"""
Binary heap / priority queue — feed ordering and top-K ranking.

A binary min-heap stores a COMPLETE binary tree inside a plain array:

    parent of index i  ->  (i - 1) // 2
    children of i      ->  2i + 1 , 2i + 2

The heap property: every parent is <= its children, so index 0 always holds
the smallest item. push/pop restore the property by "sifting" the new item
up, or the new root down — O(log n) swaps.

Where CampusConnect uses it
---------------------------
1. NEWS FEED. Posts from the user and their connections are pushed into a
   heap keyed by -timestamp (a max-heap on time). Popping one by one yields
   the posts strictly newest-first. Every "sort" of the feed therefore goes
   through a real priority queue.

2. TOP-K RANKING. "People you may know" scores every eligible student, but
   we only need the best K. We keep a bounded min-heap of size K: anything
   smaller than the heap's minimum is discarded in O(1); anything better
   evicts the weakest in O(log K). Total O(n log k) — better than a full
   O(n log n) sort when k << n.
"""


def top_k(scored_items, k):
    """Best `k` items of `scored_items` by score, DESCENDING.

    scored_items: iterable of (score, item) tuples.
    Classic bounded-heap top-K selection (min-heap of size k).
    """
    if k <= 0:
        return []
    heap = MinHeap(key=lambda entry: entry[0])   # entry = (score, item)
    for entry in scored_items:
        if len(heap) < k:
            heap.push(entry)
        elif entry[0] > heap.peek()[0]:          # beats the weakest kept?
            heap.pop()                            # evict the weakest
            heap.push(entry)
    ascending = []
    while not heap.is_empty():                    # pops smallest first
        ascending.append(heap.pop())
    return ascending[::-1]                        # reverse -> descending


class MinHeap:
    """Array-based binary min-heap with an optional custom priority `key`.

    `on_swap` (optional) is called with (index_i, index_j) every time two
    items swap — the DSA Playground uses it to record an animation trace
    of the real sift operations.
    """

    def __init__(self, key=None, on_swap=None) -> None:
        self._key = key if key is not None else (lambda item: item)
        self._items: list = []
        self._on_swap = on_swap

    # ------------------------------------------------------------------ #
    # Public interface
    # ------------------------------------------------------------------ #
    def push(self, item) -> None:
        """Add an item and sift it up to restore the heap property. O(log n)"""
        self._items.append(item)
        self._sift_up(len(self._items) - 1)

    def pop(self):
        """Remove and return the item with the SMALLEST priority. O(log n)"""
        if not self._items:
            raise IndexError("pop from an empty heap")
        self._swap(0, len(self._items) - 1)
        smallest = self._items.pop()      # the old root, now last
        if self._items:
            self._sift_down(0)            # fix the tree under the new root
        return smallest

    def peek(self):
        """Look at the minimum without removing it. O(1)"""
        if not self._items:
            raise IndexError("peek at an empty heap")
        return self._items[0]

    def is_empty(self) -> bool:
        return not self._items

    def snapshot(self) -> list:
        """Copy of the underlying array (for animation traces / tests)."""
        return list(self._items)

    def __len__(self) -> int:
        return len(self._items)

    @classmethod
    def heapify(cls, items, key=None):
        """Build a heap from an existing list in O(n) — sift down all
        internal nodes instead of pushing one by one (O(n log n))."""
        heap = cls(key)
        heap._items = list(items)
        for index in range(len(heap._items) // 2 - 1, -1, -1):
            heap._sift_down(index)
        return heap

    # ------------------------------------------------------------------ #
    # Internal mechanics
    # ------------------------------------------------------------------ #
    def _sift_up(self, index: int) -> None:
        """Move a newly appended item up while it beats its parent."""
        while index > 0:
            parent = (index - 1) // 2
            if self._key(self._items[index]) < self._key(self._items[parent]):
                self._swap(index, parent)
                index = parent
            else:
                break                      # heap property holds — stop

    def _sift_down(self, index: int) -> None:
        """Move the item at `index` down to its correct place by repeatedly
        swapping with the smaller of its two children."""
        n = len(self._items)
        while True:
            smallest = index
            left, right = 2 * index + 1, 2 * index + 2
            if left < n and self._key(self._items[left]) < self._key(self._items[smallest]):
                smallest = left
            if right < n and self._key(self._items[right]) < self._key(self._items[smallest]):
                smallest = right
            if smallest == index:
                return                      # both children are >= us — done
            self._swap(index, smallest)
            index = smallest

    def _swap(self, a: int, b: int) -> None:
        self._items[a], self._items[b] = self._items[b], self._items[a]
        if self._on_swap is not None:
            self._on_swap(a, b)
