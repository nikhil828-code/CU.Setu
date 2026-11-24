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
