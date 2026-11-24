"""Authentication routes: register / login / logout / me."""

from flask import Blueprint, jsonify, session

from network import ApiError, network_state
from routes import api_handler, body, current_username, login_required

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


@auth_bp.post("/register")
@api_handler
def register():
    data = body()
    user = network_state.register(
        username=data.get("username"),
        password=data.get("password"),
        full_name=data.get("full_name"),
        programme=data.get("programme"),
        year=data.get("year"),
        bio=data.get("bio"),
        skills=data.get("skills"),
        interests=data.get("interests"),
    )
    session["username"] = user.username   # signed session cookie
    session.permanent = True
    return jsonify({"user": network_state.user_summary(user.username)}), 201


@auth_bp.post("/login")
@api_handler
def login():
    data = body()
    user = network_state.login(data.get("username"), data.get("password"))
    session["username"] = user.username
    session.permanent = True
    return jsonify({"user": network_state.user_summary(user.username)})


@auth_bp.post("/logout")
def logout():
    session.clear()
    return jsonify({"ok": True})


@auth_bp.get("/me")
@login_required
@api_handler
def me():
    return jsonify({"user": network_state.user_summary(current_username())})
