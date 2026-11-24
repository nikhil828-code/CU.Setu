"""Search route — Trie prefix search with live suggestions."""

from flask import Blueprint, jsonify, request

from network import network_state
from routes import api_handler, current_username

search_bp = Blueprint("search", __name__)


@search_bp.get("/api/search")
@api_handler
def search():
    """?q=prefix  ->  students whose username or name-word starts with q."""
    query = (request.args.get("q") or "").strip()
    if not query:
        return jsonify({"query": "", "results": []})
    return jsonify({
        "query": query,
        "results": network_state.search(query, current_username()),
    })
