"""Notification routes — the per-student FIFO queues."""

from flask import Blueprint, jsonify

from network import network_state
from routes import api_handler, current_username, login_required

notifications_bp = Blueprint("notifications", __name__)


@notifications_bp.get("/api/notifications")
@login_required
@api_handler
def my_notifications():
    return jsonify(network_state.notifications_for(current_username()))


@notifications_bp.post("/api/notifications/read-all")
@login_required
@api_handler
def mark_all_read():
    return jsonify(network_state.mark_notifications_read(current_username()))
