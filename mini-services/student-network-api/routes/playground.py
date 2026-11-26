"""DSA Playground routes — animated traces from the REAL data structures."""

from flask import Blueprint, jsonify, request

from network import network_state
from routes import api_handler, body, current_username, login_required

playground_bp = Blueprint("playground", __name__)


@playground_bp.get("/api/playground/graph")
@login_required
@api_handler
def playground_graph():
    """Adjacency-list graph build trace over the live student network."""
    return jsonify(network_state.playground_graph())


@playground_bp.get("/api/playground/bfs")
@login_required
@api_handler
def playground_bfs():
    """Animated BFS trace from any student (parent + level + queue)."""
    source = (request.args.get("from") or current_username()).strip().lower()
    return jsonify(network_state.network_bfs(source))


@playground_bp.get("/api/playground/trie")
@login_required
@api_handler
def playground_trie():
    """Trie built live from real student searchable keywords."""
    return jsonify(network_state.playground_trie())


@playground_bp.post("/api/playground/trie/search")
@login_required
@api_handler
def playground_trie_search():
    """Prefix search replayed on the REAL in-memory trie."""
    data = body()
    return jsonify(network_state.playground_trie_search(data.get("prefix") or ""))


@playground_bp.post("/api/playground/heap")
@login_required
@api_handler
def playground_heap():
    """Min-heap trace: real student connection counts, or custom values."""
    data = body()
    raw = data.get("values")
    values = raw if isinstance(raw, list) else None
    return jsonify(network_state.playground_heap(values))


@playground_bp.get("/api/playground/hashmap")
@login_required
@api_handler
def playground_hashmap():
    """Hash-map skill counter trace over every real student profile."""
    return jsonify(network_state.playground_hashmap())
