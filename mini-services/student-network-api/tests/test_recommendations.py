"""Unit tests for the recommendation engine (Jaccard + ranking)."""

import unittest

from dsa.graph import SocialGraph
from dsa.recommendations import jaccard_similarity, people_you_may_know


def build_network():
    """
    viewer -- u1 -- target      (target shares u1 with viewer)
    viewer -- u2
    u2 ---- target              (2 mutuals: u1 and u2)
    stranger: no mutuals, but SAME programme and shared skills
    """
    graph = SocialGraph()
    profiles = {}
    for username, programme, skills in [
        ("viewer", "B.Tech CSE", ["Python", "React"]),
        ("u1", "B.Tech CSE", ["Python"]),
        ("u2", "B.Tech IT", ["Java"]),
        ("target", "B.Tech CSE", ["Python", "React", "Flask"]),
        ("stranger", "B.Tech CSE", ["Python", "Flask"]),
        ("friend-of-target", "B.Tech ECE", ["C++"]),
    ]:
        graph.add_vertex(username)
        profiles[username] = {
            "programme": programme, "year": "2nd Year",
            "skills": skills, "interests": ["Algorithms"],
        }
    graph.add_edge("viewer", "u1")
    graph.add_edge("viewer", "u2")
    graph.add_edge("u1", "target")
    graph.add_edge("u2", "target")
    graph.add_edge("target", "friend-of-target")
    return graph, profiles


class TestJaccard(unittest.TestCase):
    def test_identical_sets(self):
        self.assertEqual(jaccard_similarity({1, 2}, {1, 2}), 1.0)

    def test_disjoint_sets(self):
        self.assertEqual(jaccard_similarity({1, 2}, {3, 4}), 0.0)

    def test_half_overlap(self):
        # {1,2} shared out of union {1,2,3,4} -> 2/4
        self.assertAlmostEqual(jaccard_similarity({1, 2, 3}, {1, 2, 4}), 0.5)

    def test_empty_sets(self):
        self.assertEqual(jaccard_similarity(set(), set()), 0.0)


class TestPeopleYouMayKnow(unittest.TestCase):
    def test_self_and_connections_excluded(self):
        graph, profiles = build_network()
        recs = people_you_may_know(graph, "viewer", profiles, limit=10)
        usernames = [rec["username"] for rec in recs]
        self.assertNotIn("viewer", usernames)        # never yourself
        self.assertNotIn("u1", usernames)            # already connected
        self.assertNotIn("u2", usernames)             # already connected

    def test_pending_requests_excluded(self):
        graph, profiles = build_network()
        graph.add_pending("viewer", "friend-of-target")
        recs = people_you_may_know(graph, "viewer", profiles, limit=10)
        usernames = [rec["username"] for rec in recs]
        self.assertNotIn("friend-of-target", usernames)

    def test_mutual_count_reported(self):
        graph, profiles = build_network()
        recs = {rec["username"]: rec for rec in
                people_you_may_know(graph, "viewer", profiles, limit=10)}
        self.assertEqual(recs["target"]["mutual_count"], 2)   # u1 + u2
        self.assertEqual(recs["stranger"]["mutual_count"], 0)

    def test_higher_mutuals_rank_first(self):
        graph, profiles = build_network()
        recs = people_you_may_know(graph, "viewer", profiles, limit=10)
        self.assertEqual(recs[0]["username"], "target")

    def test_shared_skills_surfaced(self):
        graph, profiles = build_network()
        recs = {rec["username"]: rec for rec in
                people_you_may_know(graph, "viewer", profiles, limit=10)}
        self.assertIn("python", recs["stranger"]["shared_skills"])
        self.assertTrue(recs["stranger"]["same_programme"])

    def test_limit_respected(self):
        graph, profiles = build_network()
        recs = people_you_may_know(graph, "viewer", profiles, limit=1)
        self.assertEqual(len(recs), 1)

    def test_new_user_gets_profile_similarity_only(self):
        # a brand-new student has no mutuals; recs still work via skills
        graph, profiles = build_network()
        graph.add_vertex("newbie")
        profiles["newbie"] = {
            "programme": "B.Tech CSE", "year": "2nd Year",
            "skills": ["Python", "React"], "interests": ["Algorithms"],
        }
        recs = people_you_may_know(graph, "newbie", profiles, limit=10)
        top = recs[0]["username"]
        self.assertIn(top, {"viewer", "target"})    # same programme + skills


if __name__ == "__main__":
    unittest.main()
