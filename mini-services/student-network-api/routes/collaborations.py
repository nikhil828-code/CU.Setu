"""Collaboration Hub routes — project ideas, applications, team rosters."""

from flask import Blueprint, jsonify

from network import network_state
from routes import api_handler, body, current_username, login_required

collaborations_bp = Blueprint("collaborations", __name__)


@collaborations_bp.get("/api/collabs")
@login_required
@api_handler
def list_collabs():
    """Every posted collaboration, serialized for the viewer."""
    return jsonify({"collabs": network_state.collabs_for(current_username())})


@collaborations_bp.post("/api/collabs")
@login_required
@api_handler
def create_collab():
    """Post a new project idea (title, description, category, skills, size)."""
    data = body()
    collab = network_state.collab_create(
        current_username(),
        data.get("title") or "",
        data.get("description") or "",
        data.get("category") or "General",
        data.get("skills_needed") or [],
        data.get("team_size") or 4,
    )
    return jsonify(collab), 201


@collaborations_bp.post("/api/collabs/<int:collab_id>/apply")
@login_required
@api_handler
def apply_to_collab(collab_id):
    """Apply to join a collaboration (joins the owner's pending queue)."""
    data = body()
    return jsonify(network_state.collab_apply(
        current_username(), collab_id, data.get("message") or "")), 201


@collaborations_bp.get("/api/collab-applications")
@login_required
@api_handler
def my_collab_applications():
    """Pending applications for the collaborations this student owns."""
    return jsonify({"applications": network_state.collab_applications_for(current_username())})


@collaborations_bp.get("/api/collabs/<int:collab_id>/candidates")
@login_required
@api_handler
def collab_candidates(collab_id):
    """Ranked teammate suggestions (hash-indexed skills + set matching + heap)."""
    return jsonify({
        "candidates": network_state.collab_candidates(current_username(), collab_id)
    })


@collaborations_bp.post("/api/collab-applications/<int:app_id>/accept")
@login_required
@api_handler
def accept_collab_application(app_id):
    """Owner accepts: applicant joins the roster, notification sent."""
    return jsonify(network_state.collab_accept(current_username(), app_id))


@collaborations_bp.post("/api/collab-applications/<int:app_id>/reject")
@login_required
@api_handler
def reject_collab_application(app_id):
    """Owner rejects: pending application removed, notification sent."""
    return jsonify(network_state.collab_reject(current_username(), app_id))


@collaborations_bp.post("/api/collabs/<int:collab_id>/status")
@login_required
@api_handler
def set_collab_status(collab_id):
    """Owner closes / reopens recruiting: {"closed": true|false}."""
    data = body()
    closed = bool(data.get("closed"))
    return jsonify(network_state.collab_set_status(current_username(), collab_id, closed))


@collaborations_bp.delete("/api/collabs/<int:collab_id>")
@login_required
@api_handler
def delete_collab(collab_id):
    """Owner deletes the collaboration (roster + applications go too)."""
    return jsonify(network_state.collab_delete(current_username(), collab_id))
