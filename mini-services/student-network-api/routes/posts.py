"""Post / feed routes."""

from flask import Blueprint, jsonify

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
    data = body()
    post = network_state.create_post(current_username(), data.get("content", ""))
    return jsonify({"post": network_state.serialize_post(post, current_username())}), 201


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
                                        data.get("content", ""))
    return jsonify({"comment": {
        "id": comment.id,
        "author": network_state.user_summary(comment.author),
        "content": comment.content,
        "created_at": comment.created_at,
    }}), 201
