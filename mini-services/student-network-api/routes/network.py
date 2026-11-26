"""Network Explorer routes — the graph visualisation API.

All computation happens on the in-memory SocialGraph through the dsa
package (adjacency lists, BFS); these routes only serialise results.
"""

from flask import Blueprint, jsonify, request

from network import ApiError, network_state
from routes import api_handler, current_username, login_required

network_bp = Blueprint("network", __name__)


@network_bp.get("/api/network/graph")
@login_required
@api_handler
def graph_view():
    """Nodes + edges of the REAL student graph (accepted connections only).

    Each node carries its graph degree and BFS level from the logged-in
    student, so the frontend can paint 1st/2nd/3rd-degree highlights."""
    return jsonify(network_state.network_graph(current_username()))


@network_bp.get("/api/network/degrees")
@login_required
@api_handler
def network_degrees():
    """1st / 2nd / 3rd-degree buckets of any student (defaults to viewer)."""
    username = (request.args.get("username") or current_username()).strip().lower()
    return jsonify(network_state.degrees_of(username))


@network_bp.get("/api/network/path")
@login_required
@api_handler
def network_path():
    """Shortest path (BFS) between ANY two students in the network."""
    source = (request.args.get("from") or "").strip().lower()
    target = (request.args.get("to") or "").strip().lower()
    if not source or not target:
        raise ApiError("Pick two students to connect.", 400)
    if source == target:
        raise ApiError("Pick two different students.", 400)
    return jsonify(network_state.path_between(source, target))


@network_bp.get("/api/network/bfs")
@login_required
@api_handler
def network_bfs():
    """Animated BFS trace (visit order, parents, levels, queue snapshots)
    starting from any student — defaults to the logged-in student."""
    source = (request.args.get("from") or current_username()).strip().lower()
    return jsonify(network_state.network_bfs(source))
