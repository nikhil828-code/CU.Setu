"""
CampusConnect DSA package.

Every networking feature in the app is powered by one of these modules.
They are deliberately kept framework-free (no Flask imports) so they can be
unit-tested and explained in isolation during the project viva.

    queue.py          FIFO queue (linked list)      - BFS frontier, notification FIFO
    graph.py          SocialGraph (adjacency list) - the student network itself
    bfs.py            Breadth-First Search         - shortest path, degrees of separation
    trie.py           Trie (prefix tree)           - live student search
    heap.py           Binary heap / priority queue - feed ordering, top-K ranking
    recommendations.py Jaccard similarity + ranking - "People you may know"
"""
