"""Unit tests for the SocialGraph (adjacency lists)."""

import unittest

from dsa.graph import SocialGraph


def build_sample_graph() -> SocialGraph:
    """
    a -- b -- c        (a-b, b-c edges)
         |
         d -- e        (d-e edge, separate island a-b-d)
    """
    graph = SocialGraph()
    for name in ("a", "b", "c", "d", "e"):
        graph.add_vertex(name)
    graph.add_edge("a", "b")
    graph.add_edge("b", "c")
    graph.add_edge("b", "d")
    graph.add_edge("d", "e")
    return graph


class TestVertices(unittest.TestCase):
    def test_vertices_are_registered(self):
        graph = build_sample_graph()
        self.assertEqual(graph.vertices(), {"a", "b", "c", "d", "e"})

    def test_unknown_vertex_reported(self):
        self.assertFalse(build_sample_graph().has_vertex("zzz"))


class TestUndirectedEdges(unittest.TestCase):
    def test_edge_is_symmetric(self):
        graph = build_sample_graph()
        # undirected => stored in BOTH adjacency lists
        self.assertTrue(graph.is_connected("a", "b"))
        self.assertTrue(graph.is_connected("b", "a"))

    def test_no_self_connection(self):
        graph = build_sample_graph()
        with self.assertRaises(ValueError):
            graph.add_edge("a", "a")

    def test_no_duplicate_connection(self):
        graph = build_sample_graph()
        with self.assertRaises(ValueError):
            graph.add_edge("a", "b")

    def test_remove_edge(self):
        graph = build_sample_graph()
        graph.remove_edge("b", "d")
        self.assertFalse(graph.is_connected("b", "d"))
        self.assertFalse(graph.is_connected("d", "b"))
        graph.remove_edge("d", "b")      # idempotent removal
        self.assertFalse(graph.is_connected("b", "d"))

    def test_degree(self):
        graph = build_sample_graph()
        self.assertEqual(graph.degree("b"), 3)   # a, c, d
        self.assertEqual(graph.degree("a"), 1)
        self.assertEqual(graph.degree("e"), 1)

    def test_edge_count_counts_each_edge_once(self):
        graph = build_sample_graph()
        self.assertEqual(graph.edge_count(), 4)

    def test_edge_pairs_are_canonical(self):
        graph = build_sample_graph()
        pairs = set(graph.edge_pairs())
        self.assertEqual(pairs, {("a", "b"), ("b", "c"), ("b", "d"), ("d", "e")})


class TestPendingEdges(unittest.TestCase):
    def test_pending_is_directed(self):
        graph = build_sample_graph()
        graph.add_pending("a", "c")       # a -> c only
        self.assertEqual(graph.pending_direction("a", "c"), "out")
        self.assertEqual(graph.pending_direction("c", "a"), "in")
        self.assertFalse(graph.is_connected("a", "c"))   # still no edge

    def test_pending_is_removed(self):
        graph = build_sample_graph()
        graph.add_pending("a", "c")
        graph.remove_pending("a", "c")
        self.assertIsNone(graph.pending_direction("a", "c"))

    def test_pending_in_out_queues(self):
        graph = build_sample_graph()
        graph.add_pending("a", "e")      # a -> e
        graph.add_pending("c", "e")      # c -> e
        graph.add_pending("e", "b")      # e -> b
        self.assertEqual(graph.pending_incoming("e"), {"a", "c"})
        self.assertEqual(graph.pending_outgoing("e"), {"b"})


class TestMutualConnections(unittest.TestCase):
    def test_mutual_is_set_intersection(self):
        graph = build_sample_graph()
        graph.add_edge("a", "d")           # now a & d share neighbour b
        self.assertEqual(graph.mutual("a", "d"), {"b"})

    def test_mutual_empty_when_none(self):
        graph = build_sample_graph()
        self.assertEqual(graph.mutual("a", "e"), set())


if __name__ == "__main__":
    unittest.main()
