"""Recommendation route — People You May Know."""

from flask import Blueprint, jsonify, request

from network import network_state
from routes import api_handler, current_username, login_required

recommendations_bp = Blueprint("recommendations", __name__)


@recommendations_bp.get("/api/recommendations")
@login_required
@api_handler
def recommendations():
    """Ranked connection suggestions: mutuals + Jaccard similarity +
    shared skills / interests / programme, selected with a top-K heap."""
    try:
        limit = min(int(request.args.get("limit", "10")), 50)
    except ValueError:
        limit = 10
    return jsonify({
        "recommendations": network_state.recommendations(current_username(), limit)
    })


@recommendations_bp.get("/api/discovery")
@login_required
@api_handler
def smart_discovery_view():
    """Smart Discovery 2.0 — weighted compatibility ranking.

    Query parameters (all optional, defaults 40/30/20/10):
        w_mutual, w_skills, w_interests, w_major  — weight overrides
        limit                                       — how many to return
    """
    try:
        limit = min(int(request.args.get("limit", "12")), 50)
    except ValueError:
        limit = 12
    raw = {
        "mutual": request.args.get("w_mutual"),
        "skills": request.args.get("w_skills"),
        "interests": request.args.get("w_interests"),
        "major": request.args.get("w_major"),
    }
    weights = {key: value for key, value in raw.items()
               if value is not None and value != ""} or None
    return jsonify({
        "recommendations": network_state.smart_discovery(
            current_username(), limit, weights)
    })
