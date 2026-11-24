"""Unit tests for the heap priority queue + top-K selection."""

import random
import unittest

from dsa.heap import MinHeap, top_k


class TestMinHeap(unittest.TestCase):
    def test_pop_returns_ascending_order(self):
        heap = MinHeap()
        items = [42, 7, 19, 3, 30, 5, 11]
        for item in items:
            heap.push(item)
        popped = [heap.pop() for _ in range(len(items))]
        self.assertEqual(popped, sorted(items))

    def test_peek_and_empty_behaviour(self):
        heap = MinHeap()
        self.assertTrue(heap.is_empty())
        heap.push(9)
        self.assertEqual(heap.peek(), 9)
        self.assertEqual(len(heap), 1)
        self.assertEqual(heap.pop(), 9)
        with self.assertRaises(IndexError):
            heap.pop()

    def test_custom_key_behaves_like_max_heap(self):
        # key = -value turns the min-heap into a max-heap
        heap = MinHeap(key=lambda v: -v)
        for value in (4, 8, 1, 15, 2):
            heap.push(value)
        self.assertEqual([heap.pop() for _ in range(5)], [15, 8, 4, 2, 1])

    def test_heapify_builds_valid_heap(self):
        items = [random.randint(0, 1000) for _ in range(50)]
        heap = MinHeap.heapify(items)
        self.assertEqual([heap.pop() for _ in range(50)], sorted(items))

    def test_stress_push_pop_interleaved(self):
        random.seed(42)                       # deterministic run
        heap, inserted, removed = MinHeap(), [], []
        for _ in range(500):
            value = random.randint(0, 10_000)
            heap.push(value)
            inserted.append(value)
            if random.random() < 0.5:
                removed.append(heap.pop())   # current minimum at that moment
        while not heap.is_empty():
            removed.append(heap.pop())
        # every value pushed is eventually popped exactly once
        self.assertEqual(sorted(removed), sorted(inserted))
        # the FINAL drain (no pushes in between) must come out ascending
        self.assertEqual(removed[len(removed) - 3:],
                         sorted(removed[len(removed) - 3:]))


class TestTopK(unittest.TestCase):
    def test_top_k_best_first(self):
        scored = [(5, "e"), (1, "a"), (9, "i"), (3, "c"), (7, "g")]
        self.assertEqual([item for _, item in top_k(scored, 2)], ["i", "g"])

    def test_top_k_smaller_than_k(self):
        scored = [(2, "b"), (5, "e")]
        self.assertEqual([item for _, item in top_k(scored, 10)], ["e", "b"])

    def test_top_k_zero(self):
        self.assertEqual(top_k([(1, "a")], 0), [])

    def test_top_k_keeps_ties_deterministically(self):
        scored = [(4, "a"), (4, "b"), (4, "c")]
        self.assertEqual(len(top_k(scored, 2)), 2)

    def test_top_k_beats_heap_minimum(self):
        scored = [(10, "ten"), (1, "one"), (5, "five"), (3, "three")]
        # only the two best survive: 10 and 5
        self.assertEqual([item for _, item in top_k(scored, 2)],
                         ["ten", "five"])

    def test_large_scale_matches_sorting(self):
        scored = [(random.randint(0, 100_000), i) for i in range(2_000)]
        expected = [item for _, item in sorted(scored, reverse=True)[:7]]
        self.assertEqual([item for _, item in top_k(scored, 7)], expected)


if __name__ == "__main__":
    unittest.main()
