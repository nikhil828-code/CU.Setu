"""Shared helpers for every route blueprint."""

from functools import wraps

from flask import jsonify, request, session

from network import ApiError, network_state


def current_username():
    """Read the signed session cookie -> username, or None if logged out."""
    username = session.get("username")
    if username and username in network_state.users:
        return username
    return None


def login_required(fn):
    """Reject unauthenticated requests with a clean JSON 401."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if current_username() is None:
            return jsonify({"error": "Please log in first."}), 401
        return fn(*args, **kwargs)
    return wrapper


def api_handler(fn):
    """Turn ApiError exceptions raised by the service layer into the proper
    JSON error response: {"error": message} + HTTP status."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        try:
            return fn(*args, **kwargs)
        except ApiError as exc:
            return jsonify({"error": exc.message}), exc.status
    return wrapper


def body() -> dict:
    """Parsed JSON request body ({} when absent or malformed)."""
    data = request.get_json(silent=True)
    return data if isinstance(data, dict) else {}
