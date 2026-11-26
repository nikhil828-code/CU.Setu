"""
Queue — FIFO data structure built on a singly linked list.

Where it is used in CampusConnect
---------------------------------
1. BFS frontier          (dsa/bfs.py)  — the textbook usage of a FIFO queue.
2. Pending requests      — conceptual queue of requests waiting to be accepted.
3. Notification delivery — notifications are enqueued per student and served
                           in the exact order the events happened (FIFO).

Why a linked list?
------------------
We keep a pointer to BOTH the head (front) and the tail (back):
    enqueue  ->  attach to the tail            O(1)
    dequeue  ->  unlink the head              O(1)
An array-based queue would need index juggling or O(n) shifts on dequeue.
"""

from typing import Any


class _Node:
    """One link of the singly linked list."""

    __slots__ = ("value", "next")

    def __init__(self, value: Any) -> None:
        self.value = value
        self.next = None


class LinkedQueue:
    """A first-in-first-out queue with O(1) enqueue and dequeue."""

    def __init__(self) -> None:
        self._head: _Node | None = None  # front of the queue (next to leave)
        self._tail: _Node | None = None  # back of the queue  (last to arrive)
        self._size = 0

    # ------------------------------------------------------------------ #
    # Core operations
    # ------------------------------------------------------------------ #
    def enqueue(self, value: Any) -> None:
        """Add an item to the BACK of the queue.  O(1)"""
        node = _Node(value)
        if self._tail is None:            # queue is empty
            self._head = node
            self._tail = node
        else:
            self._tail.next = node        # link after the current tail
            self._tail = node             # move the tail pointer
        self._size += 1

    def dequeue(self) -> Any:
        """Remove and return the item at the FRONT.  O(1)

        Raises IndexError if the queue is empty.
        """
        if self._head is None:
            raise IndexError("dequeue from an empty queue")
        node = self._head
        self._head = node.next            # advance the front pointer
        if self._head is None:            # queue just became empty
            self._tail = None
        self._size -= 1
        return node.value

    def peek(self) -> Any:
        """Look at the front item without removing it.  O(1)"""
        if self._head is None:
            raise IndexError("peek at an empty queue")
        return self._head.value

    # ------------------------------------------------------------------ #
    # Introspection helpers
    # ------------------------------------------------------------------ #
    def is_empty(self) -> bool:
        return self._head is None

    def __len__(self) -> int:
        return self._size

    def __bool__(self) -> bool:
        """Allows the neat  `while frontier:`  loop style in BFS."""
        return self._head is not None

    def to_list(self) -> list:
        """Return the queue contents front-to-back (useful for debugging)."""
        values, node = [], self._head
        while node is not None:
            values.append(node.value)
            node = node.next
        return values
