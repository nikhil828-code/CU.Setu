"""Project Showcase routes — publish, edit, feature, cover uploads."""

from flask import Blueprint, jsonify, request

import media
from network import network_state
from routes import api_handler, current_username, login_required

showcase_bp = Blueprint("showcase", __name__)


def _project_fields_from_request() -> dict:
    """Read project fields from EITHER multipart form data (with an
    optional cover file) or a JSON body — mirrors the post composer."""
    content_type = (request.content_type or "").lower()
    if content_type.startswith("multipart/form-data"):
        form = request.form
        tech = [s for s in (form.get("tech_stack") or "").split(",") if s.strip()]
        cover = request.files.get("cover")
        cover_url = ""
        if cover is not None and cover.filename:
            cover_url = media.save_project_cover(cover, current_username())
        return {
            "title": form.get("title") or "",
            "description": form.get("description") or "",
            "cover_url": cover_url,
            "tech_stack": tech,
            "github_url": form.get("github_url") or "",
            "demo_url": form.get("demo_url") or "",
            "category": form.get("category") or "General",
        }
    data = request.get_json(silent=True) or {}
    tech = data.get("tech_stack") or []
    if isinstance(tech, str):
        tech = [s for s in tech.split(",") if s.strip()]
    return {
        "title": data.get("title") or "",
        "description": data.get("description") or "",
        "cover_url": data.get("cover_url") or "",
        "tech_stack": tech,
        "github_url": data.get("github_url") or "",
        "demo_url": data.get("demo_url") or "",
        "category": data.get("category") or "General",
    }


@showcase_bp.get("/api/projects")
@login_required
@api_handler
def list_projects():
    """Every published project (optional ?category= filter)."""
    category = request.args.get("category", "").strip()
    return jsonify({"projects": network_state.projects_for(current_username(), category)})


@showcase_bp.post("/api/projects")
@login_required
@api_handler
def publish_project():
    """Publish a project — multipart (with optional cover image) or JSON."""
    fields = _project_fields_from_request()
    project = network_state.project_create(
        current_username(),
        fields["title"], fields["description"], fields["cover_url"],
        fields["tech_stack"], fields["github_url"], fields["demo_url"],
        fields["category"],
    )
    return jsonify(project), 201


@showcase_bp.put("/api/projects/<int:project_id>")
@login_required
@api_handler
def edit_project(project_id):
    """Edit an owned project (cover field '' keeps the existing cover)."""
    fields = _project_fields_from_request()
    project = network_state.project_update(
        current_username(), project_id,
        fields["title"], fields["description"], fields["cover_url"],
        fields["tech_stack"], fields["github_url"], fields["demo_url"],
        fields["category"],
    )
    return jsonify(project)


@showcase_bp.post("/api/projects/<int:project_id>/featured")
@login_required
@api_handler
def toggle_featured(project_id):
    """Owner toggles the spotlight flag."""
    return jsonify(network_state.project_toggle_featured(current_username(), project_id))


@showcase_bp.delete("/api/projects/<int:project_id>")
@login_required
@api_handler
def delete_project(project_id):
    """Delete an owned project."""
    return jsonify(network_state.project_delete(current_username(), project_id))


@showcase_bp.post("/api/projects/<int:project_id>/contributors")
@login_required
@api_handler
def add_contributor(project_id):
    """Credit a contributor: {"username": "..."}. Notifies the student."""
    from routes import body
    data = body()
    return jsonify(network_state.project_add_contributor(
        current_username(), project_id, data.get("username") or "")), 201


@showcase_bp.delete("/api/projects/<int:project_id>/contributors/<username>")
@login_required
@api_handler
def remove_contributor(project_id, username):
    """Remove a credited contributor."""
    return jsonify(network_state.project_remove_contributor(
        current_username(), project_id, username))
