"""Unit tests for the Trie (prefix search)."""

import unittest

from dsa.trie import Trie


class TestTrie(unittest.TestCase):
    def setUp(self):
        self.trie = Trie()
        # username + every word of the full name, exactly like the app does
        for username, full_name in [
            ("aarav", "Aarav Sharma"),
            ("ananya", "Ananya Das"),
            ("ishita", "Ishita Verma"),
            ("meera", "Meera Krishnan"),
        ]:
            self.trie.insert(username, username)
            for word in full_name.split():
                self.trie.insert(word, username)

    def test_prefix_matches_first_letters(self):
        self.assertEqual(self.trie.prefix_matches("aa"), ["aarav"])

    def test_prefix_matches_are_case_insensitive(self):
        self.assertEqual(set(self.trie.prefix_matches("AN")),
                         {"ananya"})

    def test_name_word_prefix_matches(self):
        self.assertEqual(self.trie.prefix_matches("shar"), ["aarav"])
        self.assertEqual(set(self.trie.prefix_matches("me")), {"meera"})

    def test_multiple_matches_collected(self):
        self.assertEqual(set(self.trie.prefix_matches("a")),
                         {"aarav", "ananya"})

    def test_unknown_prefix_returns_empty(self):
        self.assertEqual(self.trie.prefix_matches("zz"), [])

    def test_empty_prefix_returns_empty(self):
        self.assertEqual(self.trie.prefix_matches(""), [])

    def test_limit_applied(self):
        matches = self.trie.prefix_matches("a", limit=1)
        self.assertEqual(matches, ["aarav"])   # sorted + truncated

    def test_remove_unindexes_the_student(self):
        self.trie.remove("aarav", "aarav")
        self.assertEqual(self.trie.prefix_matches("aarav"), [])
        # the other student is untouched
        self.assertEqual(set(self.trie.prefix_matches("a")), {"ananya"})

    def test_remove_prunes_empty_branches(self):
        self.trie.remove("ananya", "ananya")
        # 'ana...' branch still used by nothing else must be pruned, while
        # other 'a' words keep working (a word that shares the prefix).
        self.assertEqual(self.trie.prefix_matches("ananya"), [])
        self.assertEqual(self.trie.prefix_matches("aa"), ["aarav"])


if __name__ == "__main__":
    unittest.main()
