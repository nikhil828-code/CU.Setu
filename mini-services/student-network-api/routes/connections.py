"""Connection + connection-request routes — the graph API."""

from flask import Blueprint, jsonify

from network import network_state
from routes import api_handler, body, current_username, login_required

connections_bp = Blueprint("connections", __name__)


@connections_bp.get("/api/connections")
@login_required
@api_handler
def my_connections():
    """All accepted (first-degree) connections of the logged-in student."""
    return jsonify({"connections": network_state.connections_of(current_username())})


@connections_bp.get("/api/degrees")
@login_required
@api_handler
def my_degrees():
    """1st / 2nd / 3rd-degree network (BFS level buckets)."""
    return jsonify(network_state.degrees_of(current_username()))


@connections_bp.get("/api/connections/mutual/<username>")
@login_required
@api_handler
def mutual(username):
    """Mutual connections = set intersection of the two adjacency lists."""
    return jsonify({"mutual": network_state.mutual_with(current_username(), username)})


@connections_bp.get("/api/connections/path/<username>")
@login_required
@api_handler
def connection_path(username):
    """Shortest connection chain found by BFS."""
    return jsonify(network_state.path_between(current_username(), username))


@connections_bp.delete("/api/connections/<username>")
@login_required
@api_handler
def remove_connection(username):
    """Disconnect an existing connection (removes the undirected edge)."""
    return jsonify(network_state.remove_connection(current_username(), username))


# --------------------------------------------------------------------------- #
# Pending requests
# --------------------------------------------------------------------------- #
@connections_bp.get("/api/requests")
@login_required
@api_handler
def my_requests():
    """Pending requests received + sent, in FIFO order."""
    return jsonify(network_state.requests_for(current_username()))


@connections_bp.post("/api/requests")
@login_required
@api_handler
def send_request():
    """Send a connection request -> directed pending edge."""
    data = body()
    network_state.send_request(current_username(), (data.get("username") or "").strip().lower())
    return jsonify({"ok": True, "status": "pending"}), 201


@connections_bp.post("/api/requests/<int:request_id>/accept")
@login_required
@api_handler
def accept_request(request_id):
    """Accept: directed edge -> undirected edge."""
    return jsonify(network_state.accept_request(request_id, current_username()))


@connections_bp.post("/api/requests/<int:request_id>/reject")
@login_required
@api_handler
def reject_request(request_id):
    """Reject: the directed edge is removed, never becoming a connection."""
    return jsonify(network_state.reject_request(request_id, current_username()))


@connections_bp.post("/api/requests/<int:request_id>/cancel")
@login_required
@api_handler
def cancel_request(request_id):
    """Cancel my own outgoing pending request."""
    return jsonify(network_state.cancel_request(request_id, current_username()))
