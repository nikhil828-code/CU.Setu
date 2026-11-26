"""Campus Skill Analytics routes — hash-map counts + heap rankings."""

from flask import Blueprint, jsonify, request

from network import network_state
from routes import api_handler, current_username, login_required

analytics_bp = Blueprint("analytics", __name__)


@analytics_bp.get("/api/analytics/skills")
@login_required
@api_handler
def skills_overview():
    """Top skills, programme / year distributions — computed live from the
    real student profiles (hash-map counting + top-K heap ranking)."""
    return jsonify(network_state.skill_analytics())


@analytics_bp.get("/api/analytics/skills/students")
@login_required
@api_handler
def students_for_skill():
    """Students who have a skill (?skill=python) — inverted-index lookup."""
    skill = request.args.get("skill", "")
    return jsonify({"students": network_state.students_by_skill(skill)})


@analytics_bp.get("/api/analytics/skills/complementary")
@login_required
@api_handler
def complementary_for_skill():
    """Skills that co-occur most with a skill (?skill=react) — set logic."""
    skill = request.args.get("skill", "")
    return jsonify(network_state.complementary_for_skill(skill))
