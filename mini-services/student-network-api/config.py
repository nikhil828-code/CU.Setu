"""Central configuration for the CampusConnect backend service."""

import os

# --------------------------------------------------------------------------- #
# Service port
# --------------------------------------------------------------------------- #
# The Flask API listens here. The Next.js frontend reaches this service through
# the sandbox gateway, so every frontend request carries
#     ?XTransformPort=5001
# and the gateway proxies it to localhost:5001.
PORT = int(os.environ.get("CAMPUS_CONNECT_PORT", "5001"))

# --------------------------------------------------------------------------- #
# Filesystem locations
# --------------------------------------------------------------------------- #
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
DB_PATH = os.environ.get("CAMPUS_CONNECT_DB", os.path.join(DATA_DIR, "network.db"))

os.makedirs(DATA_DIR, exist_ok=True)

# --------------------------------------------------------------------------- #
# Security
# --------------------------------------------------------------------------- #
# Secret used to sign Flask session cookies (login sessions).
SECRET_KEY = os.environ.get("CAMPUS_CONNECT_SECRET", "campus-connect-dev-secret-2025")

# PBKDF2-HMAC-SHA256 iteration count for password hashing.
# 100k iterations is a good speed/security balance for a demo-grade service.
PBKDF2_ITERATIONS = 100_000

# --------------------------------------------------------------------------- #
# Validation limits
# --------------------------------------------------------------------------- #
USERNAME_MIN, USERNAME_MAX = 3, 24
PASSWORD_MIN = 6
POST_MAX_CHARS = 1000

# --------------------------------------------------------------------------- #
# Uploaded media (profile photos, profile backgrounds, post photos / videos)
# --------------------------------------------------------------------------- #
UPLOAD_DIR = os.path.join(DATA_DIR, "uploads")
AVATAR_DIR = os.path.join(UPLOAD_DIR, "avatars")
COVER_DIR = os.path.join(UPLOAD_DIR, "covers")
POST_MEDIA_DIR = os.path.join(UPLOAD_DIR, "posts")

for _dir in (UPLOAD_DIR, AVATAR_DIR, COVER_DIR, POST_MEDIA_DIR):
    os.makedirs(_dir, exist_ok=True)

# Largest single upload accepted by the Flask app (photos or videos).
MAX_MEDIA_BYTES = 25 * 1024 * 1024          # 25 MB

# Allowed file extensions per media kind.
IMAGE_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "webp"}
VIDEO_EXTENSIONS = {"mp4", "webm", "mov"}
MEDIA_TYPE_FOR_EXTENSION = {
    **{ext: "image" for ext in IMAGE_EXTENSIONS},
    **{ext: "video" for ext in VIDEO_EXTENSIONS},
}
