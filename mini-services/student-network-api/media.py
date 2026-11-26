"""
Uploaded media handling — profile photos, profile backgrounds and the
photos / videos attached to posts.

A browser sends a multipart/form-data request; we validate the extension
and size, generate a collision-proof filename and store the file under
data/uploads/<folder>/. Files are later served by the Flask route
GET /api/media/<folder>/<filename> so the sandbox gateway can reach them
through the same /api/* path space as everything else.
"""

import os
import secrets
import time

from werkzeug.utils import secure_filename

import config
from errors import ApiError

# Per-kind size caps (the app-level MAX_CONTENT_LENGTH is the hard stop).
MAX_AVATAR_BYTES = 8 * 1024 * 1024       # 8 MB profile photo
MAX_COVER_BYTES = 10 * 1024 * 1024       # 10 MB profile background
MAX_POST_MEDIA_BYTES = 25 * 1024 * 1024  # 25 MB post photo / video


def _extension_of(filename: str) -> str:
    """Lower-cased file extension without the dot ('' when missing)."""
    return os.path.splitext(secure_filename(filename))[1].lstrip(".").lower()


def _validate(raw_storage, max_bytes: int, kind_label: str) -> str:
    """Common validation for an uploaded FileStorage. Returns the extension."""
    if raw_storage is None or not raw_storage.filename:
        raise ApiError(f"Please choose a {kind_label} file.", 400)
    extension = _extension_of(raw_storage.filename)
    if extension not in config.MEDIA_TYPE_FOR_EXTENSION:
        raise ApiError(
            f".{extension or '?'} files are not supported. Use an image "
            f"({', '.join(sorted(config.IMAGE_EXTENSIONS))}) or a video "
            f"({', '.join(sorted(config.VIDEO_EXTENSIONS))}).", 400)
    raw_storage.seek(0, os.SEEK_END)
    size = raw_storage.tell()
    raw_storage.seek(0)
    if size == 0:
        raise ApiError("The selected file is empty.", 400)
    if size > max_bytes:
        raise ApiError(
            f"{kind_label.capitalize()} files are limited to "
            f"{max_bytes // (1024 * 1024)} MB.", 413)
    return extension


def _store(raw_storage, directory: str, username: str, extension: str) -> str:
    """Write the upload to `directory` with a unique safe name and return
    the public URL used by the frontend."""
    unique = f"{int(time.time())}_{secrets.token_hex(4)}"
    safe_name = secure_filename(raw_storage.filename) or "upload"
    filename = f"{username}_{unique}_{safe_name}"
    raw_storage.save(os.path.join(directory, filename))
    folder = os.path.basename(directory)
    return f"/api/media/{folder}/{filename}"


def save_post_media(raw_storage, username: str) -> tuple[str, str]:
    """Validate + persist a post photo/video. Returns (url, media_type)."""
    extension = _validate(raw_storage, MAX_POST_MEDIA_BYTES, "post media")
    media_type = config.MEDIA_TYPE_FOR_EXTENSION[extension]
    url = _store(raw_storage, config.POST_MEDIA_DIR, username, extension)
    return url, media_type


def save_avatar(raw_storage, username: str) -> str:
    """Validate + persist a profile photo. Returns the public URL."""
    if _extension_of(raw_storage.filename or "") not in config.IMAGE_EXTENSIONS:
        raise ApiError("Profile photos must be an image "
                          "(png, jpg, jpeg, gif or webp).", 400)
    _validate(raw_storage, MAX_AVATAR_BYTES, "profile photo")
    return _store(raw_storage, config.AVATAR_DIR, username,
                  _extension_of(raw_storage.filename))


def save_cover(raw_storage, username: str) -> str:
    """Validate + persist a profile background image. Returns the public URL."""
    if _extension_of(raw_storage.filename or "") not in config.IMAGE_EXTENSIONS:
        raise ApiError("Profile backgrounds must be an image "
                          "(png, jpg, jpeg, gif or webp).", 400)
    _validate(raw_storage, MAX_COVER_BYTES, "profile background")
    return _store(raw_storage, config.COVER_DIR, username,
                  _extension_of(raw_storage.filename))


MAX_PROJECT_COVER_BYTES = 10 * 1024 * 1024    # 10 MB project cover image


def save_project_cover(raw_storage, username: str) -> str:
    """Validate + persist a Project Showcase cover image. Returns the URL."""
    if _extension_of(raw_storage.filename or "") not in config.IMAGE_EXTENSIONS:
        raise ApiError("Project covers must be an image "
                      "(png, jpg, jpeg, gif or webp).", 400)
    _validate(raw_storage, MAX_PROJECT_COVER_BYTES, "project cover")
    return _store(raw_storage, config.PROJECT_MEDIA_DIR, username,
                  _extension_of(raw_storage.filename))
