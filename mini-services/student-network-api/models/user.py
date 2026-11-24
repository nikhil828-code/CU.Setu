"""
User model + secure password hashing.

Passwords are NEVER stored in plain text. We use PBKDF2-HMAC-SHA256 from
Python's standard `hashlib`:

    stored = "pbkdf2_sha256$<iterations>$<salt>$<digest-hex>"

Each user gets a fresh random salt, so identical passwords produce different
hashes, rainbow tables are useless, and verification is a constant-time
`secrets.compare_digest` comparison.
"""

import hashlib
import secrets
from dataclasses import dataclass, field
from typing import List

from config import PBKDF2_ITERATIONS


@dataclass
class User:
    """A student account + profile.

    Lookups by username happen against a hash table (dict) in the service
    layer, so this dataclass stays a plain record.
    """

    username: str
    full_name: str
    password_hash: str
    programme: str = ""
    year: str = ""
    bio: str = ""
    skills: List[str] = field(default_factory=list)
    interests: List[str] = field(default_factory=list)
    # Public URLs of the uploaded profile photo / profile background.
    # Empty string -> the UI falls back to initials / gradient banner.
    avatar_url: str = ""
    cover_url: str = ""
    created_at: str = ""


def hash_password(password: str) -> str:
    """Hash a password with a fresh random salt. Returns the full
    self-describing string `algorithm$iterations$salt$digest`."""
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        PBKDF2_ITERATIONS,
    )
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    """Constant-time check of a candidate password against a stored hash."""
    try:
        _algorithm, iterations, salt, digest_hex = stored.split("$")
        computed = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt.encode("utf-8"),
            int(iterations),
        )
    except (ValueError, AttributeError):
        return False
    return secrets.compare_digest(computed.hex(), digest_hex)
