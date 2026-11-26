"""Post / feed routes."""

from flask import Blueprint, jsonify, request

import media
from network import network_state
from routes import api_handler, body, current_username, login_required

posts_bp = Blueprint("posts", __name__)


@posts_bp.get("/api/feed")
@login_required
@api_handler
def feed():
    """News feed: posts by me + my connections, newest first (heap)."""
    return jsonify({"posts": network_state.feed(current_username())})


@posts_bp.post("/api/posts")
@login_required
@api_handler
def create_post():
    """Create a post — either JSON `{content}` or multipart form data with
    an optional `media` file (photo or video) attached to the text."""
    username = current_username()
    media_url, media_type = "", ""

    content_type = (request.content_type or "").lower()
    if content_type.startswith("multipart/form-data"):
        # Multipart upload (the browser composer always posts FormData, with
        # or without a file): text fields arrive in request.form.
        content = request.form.get("content", "")
        upload = request.files.get("media")
        if upload is not None:
            media_url, media_type = media.save_post_media(upload, username)
    else:
        content = body().get("content", "")

    post = network_state.create_post(username, content, media_url, media_type)
    return jsonify({"post": network_state.serialize_post(post, username)}), 201


@posts_bp.delete("/api/posts/<int:post_id>")
@login_required
@api_handler
def delete_post(post_id):
    return jsonify(network_state.delete_post(post_id, current_username()))


@posts_bp.post("/api/posts/<int:post_id>/like")
@login_required
@api_handler
def toggle_like(post_id):
    return jsonify(network_state.toggle_like(post_id, current_username()))


@posts_bp.post("/api/posts/<int:post_id>/comments")
@login_required
@api_handler
def add_comment(post_id):
    data = body()
    comment = network_state.add_comment(post_id, current_username(),
                                        data.get("content", ""),
                                        data.get("parent_id"))
    return jsonify({"comment":
                    network_state.serialize_comment(comment,
                                                    current_username())}), 201


@posts_bp.post("/api/comments/<int:comment_id>/like")
@login_required
@api_handler
def toggle_comment_like(comment_id):
    """Like / unlike a comment (one like per user, O(1) set lookup)."""
    return jsonify(network_state.toggle_comment_like(comment_id,
                                                     current_username()))
