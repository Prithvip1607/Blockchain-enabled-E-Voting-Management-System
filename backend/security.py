"""Password hashing (bcrypt) and JWT helpers. No secrets are hard-coded: JWT_SECRET comes from the environment."""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

ALGORITHM = "HS256"


def _secret() -> str:
    secret = os.getenv("JWT_SECRET", "")
    if len(secret) < 32:
        raise RuntimeError(
            "JWT_SECRET is missing or too short (need 32+ characters). "
            'Generate one: python -c "import secrets; print(secrets.token_urlsafe(48))"'
        )
    return secret


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("ascii")


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("ascii"))
    except ValueError:
        return False


# Used to spend the same time on unknown users as on real ones (reduces user enumeration by timing).
_DUMMY_HASH = None


def dummy_verify(password: str) -> None:
    global _DUMMY_HASH
    if _DUMMY_HASH is None:
        _DUMMY_HASH = hash_password("dummy-password-for-timing")
    verify_password(password, _DUMMY_HASH)


def create_token(voter_id: str, role: str) -> str:
    minutes = int(os.getenv("JWT_EXPIRE_MINUTES", "60"))
    now = datetime.now(timezone.utc)
    payload = {"sub": voter_id, "role": role, "iat": now, "exp": now + timedelta(minutes=minutes)}
    return jwt.encode(payload, _secret(), algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    """Raises jwt.PyJWTError if the token is invalid or expired."""
    return jwt.decode(token, _secret(), algorithms=[ALGORITHM])
