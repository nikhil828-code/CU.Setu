"""Unit tests for BFS: shortest path, levels, connection degrees."""

import unittest

from dsa.bfs import bfs_levels, bfs_visit_order, connection_degrees, shortest_path
from dsa.graph import SocialGraph


def build_sample_graph() -> SocialGraph:
    """
    a -- b -- c -- f      (a to f shortest path length 3)
    |    |
    d -- e                (a-d, b-d, d-e)
           |
           g              (e-g) so a->g = a-d-e-g (3 hops) or a-b-d-e-g (4)
    """
    graph = SocialGraph()
    for name in ("a", "b", "c", "d", "e", "f", "g"):
        graph.add_vertex(name)
    graph.add_edge("a", "b")
    graph.add_edge("b", "c")
    graph.add_edge("c", "f")
    graph.add_edge("a", "d")
    graph.add_edge("b", "d")
    graph.add_edge("d", "e")
    graph.add_edge("e", "g")
    return graph


class TestShortestPath(unittest.TestCase):
    def test_direct_connection_is_length_one(self):
        path = shortest_path(build_sample_graph(), "a", "b")
        self.assertEqual(path, ["a", "b"])

    def test_shortest_route_beats_longer_routes(self):
        # a -> d -> e -> g (3 hops) must beat a -> b -> d -> e -> g
        path = shortest_path(build_sample_graph(), "a", "g")
        self.assertEqual(path, ["a", "d", "e", "g"])

    def test_unreachable_returns_none(self):
        graph = build_sample_graph()
        graph.add_vertex("z")              # isolated vertex
        self.assertIsNone(shortest_path(graph, "a", "z"))

    def test_same_source_and_target(self):
        self.assertEqual(shortest_path(build_sample_graph(), "a", "a"), ["a"])


class TestBfsLevels(unittest.TestCase):
    def test_levels_are_degrees_of_separation(self):
        levels = bfs_levels(build_sample_graph(), "a")
        self.assertEqual(levels["a"], 0)
        self.assertEqual(levels["b"], 1)
        self.assertEqual(levels["d"], 1)
        self.assertEqual(levels["c"], 2)   # a-b-c (not directly linked to a)
        self.assertEqual(levels["e"], 2)
        self.assertEqual(levels["f"], 3)
        self.assertEqual(levels["g"], 3)

    def test_visit_order_is_level_by_level(self):
        order = bfs_visit_order(build_sample_graph(), "a")
        # level 1 members must appear before level 2 members
        self.assertLess(max(order.index("b"), order.index("d")),
                        min(order.index("c"), order.index("e")))
        self.assertLess(order.index("d"), order.index("g"))


class TestConnectionDegrees(unittest.TestCase):
    def test_degree_buckets(self):
        buckets, beyond = connection_degrees(build_sample_graph(), "a")
        self.assertEqual(buckets[1], {"b", "d"})
        self.assertEqual(buckets[2], {"c", "e"})
        self.assertEqual(buckets[3], {"f", "g"})
        self.assertEqual(beyond, set())

    def test_beyond_three_degrees(self):
        graph = build_sample_graph()
        for name in ("h", "i", "j", "k"):
            graph.add_vertex(name)
        graph.add_edge("g", "h")   # a->h 4 hops
        graph.add_edge("h", "i")   # a->i 5 hops
        buckets, beyond = connection_degrees(graph, "a")
        self.assertEqual(beyond, {"h", "i"})
        self.assertEqual(buckets[3], {"f", "g"})


if __name__ == "__main__":
    unittest.main()
