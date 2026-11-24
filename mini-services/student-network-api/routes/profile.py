"""Profile routes."""

from flask import Blueprint, jsonify, request

import media
from network import network_state
from routes import api_handler, body, current_username, login_required

profile_bp = Blueprint("profile", __name__)


@profile_bp.get("/api/users/<username>")
@api_handler
def get_user(username):
    """Full profile of one student + relationship state for the viewer."""
    return jsonify({
        "user": network_state.user_profile(username, current_username())
    })


@profile_bp.get("/api/users/<username>/posts")
@api_handler
def user_posts(username):
    """All posts by one student, newest first (heap ordered)."""
    return jsonify({
        "posts": network_state.posts_by(username, current_username())
    })


@profile_bp.put("/api/profile")
@login_required
@api_handler
def edit_profile():
    data = body()
    user = network_state.update_profile(
        username=current_username(),
        full_name=data.get("full_name"),
        programme=data.get("programme"),
        year=data.get("year"),
        bio=data.get("bio"),
        skills=data.get("skills"),
        interests=data.get("interests"),
    )
    return jsonify({"user": network_state.user_summary(user.username)})


@profile_bp.post("/api/profile/photo")
@login_required
@api_handler
def upload_profile_photo():
    """Multipart upload of a new profile photo (form field: `photo`)."""
    upload = request.files.get("photo")
    avatar_url = media.save_avatar(upload, current_username())
    user = network_state.set_profile_photo(current_username(), avatar_url)
    return jsonify({"user": network_state.user_summary(user.username)})


@profile_bp.post("/api/profile/cover")
@login_required
@api_handler
def upload_profile_cover():
    """Multipart upload of a new profile background (form field: `cover`)."""
    upload = request.files.get("cover")
    cover_url = media.save_cover(upload, current_username())
    user = network_state.set_cover_photo(current_username(), cover_url)
    return jsonify({"user": network_state.user_summary(user.username)})


@profile_bp.delete("/api/profile/photo")
@login_required
@api_handler
def remove_profile_photo():
    """Reset to the default initials avatar."""
    user = network_state.set_profile_photo(current_username(), "")
    return jsonify({"user": network_state.user_summary(user.username)})


@profile_bp.delete("/api/profile/cover")
@login_required
@api_handler
def remove_profile_cover():
    """Reset to the default gradient background."""
    user = network_state.set_cover_photo(current_username(), "")
    return jsonify({"user": network_state.user_summary(user.username)})
