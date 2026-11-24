"""Serving uploaded media (profile photos, backgrounds, post photos/videos)."""

from flask import Blueprint, send_from_directory

import config

media_bp = Blueprint("media", __name__)

# Whitelisted upload folders — anything else is refused so that the
# <folder> segment can never be used to walk out of the uploads directory.
_FOLDERS = ("avatars", "covers", "posts")


@media_bp.get("/api/media/<folder>/<filename>")
def serve_media(folder: str, filename: str):
    if folder not in _FOLDERS:
        return {"error": "Unknown media folder."}, 404
    directory = {
        "avatars": config.AVATAR_DIR,
        "covers": config.COVER_DIR,
        "posts": config.POST_MEDIA_DIR,
    }[folder]
    return send_from_directory(directory, filename, conditional=True)
