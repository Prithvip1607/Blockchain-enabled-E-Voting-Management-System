"""ChainVote application backend (FastAPI + MySQL).

Responsibilities (OFF-CHAIN only):
  * account registration and login
  * user profile / voter management for administrators

This backend does NOT count votes and does NOT authorise blockchain actions.
Election data, candidates, votes and administrator rights live in the Solidity contract on
Ethereum Sepolia. Signing in here is separate from connecting a MetaMask wallet.

Run from the project root:
    uvicorn backend.main:app --reload
"""
from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path

import jwt
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .database import User, get_db, init_db
from .database.db import get_engine
from .security import create_token, decode_token, dummy_verify, hash_password, verify_password

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

SRC_DIR = ROOT / "src"


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(title="ChainVote API", version="1.0.0", lifespan=lifespan)

_origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]
if _origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_origins,
        allow_methods=["GET", "POST", "DELETE"],
        allow_headers=["Authorization", "Content-Type"],
    )

CSP = (
    "default-src 'self'; "
    "script-src 'self'; "
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
    "font-src https://fonts.gstatic.com; "
    "img-src 'self' data:; "
    "connect-src 'self' https:; "  # https: lets the browser reach the Sepolia read RPC configured in src/js/config.js
    "frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    response.headers.setdefault("Content-Security-Policy", CSP)
    return response


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------
def _check_password(v: str) -> str:
    if len(v.encode("utf-8")) > 72:  # bcrypt only uses the first 72 bytes
        raise ValueError("Password must be at most 72 bytes.")
    return v


class SignupIn(BaseModel):
    voter_id: str = Field(min_length=3, max_length=32, pattern=r"^\S+$")
    password: str = Field(min_length=6, max_length=72)

    @field_validator("password")
    @classmethod
    def password_bytes(cls, v: str) -> str:
        return _check_password(v)


class LoginIn(BaseModel):
    voter_id: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=72)


class ChangePasswordIn(BaseModel):
    old_password: str = Field(min_length=1, max_length=72)
    new_password: str = Field(min_length=6, max_length=72)

    @field_validator("new_password")
    @classmethod
    def password_bytes(cls, v: str) -> str:
        return _check_password(v)


class TokenOut(BaseModel):
    token: str
    role: str
    voter_id: str


class UserOut(BaseModel):
    voter_id: str
    role: str
    created_at: str | None = None


def _user_out(u: User) -> UserOut:
    return UserOut(voter_id=u.voter_id, role=u.role, created_at=u.created_at.isoformat() if u.created_at else None)


# ---------------------------------------------------------------------------
# Auth dependencies
# ---------------------------------------------------------------------------
bearer = HTTPBearer(auto_error=False)


def current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer), db: Session = Depends(get_db)
) -> User:
    unauthorised = HTTPException(status.HTTP_401_UNAUTHORIZED, "Please sign in again.")
    if creds is None:
        raise unauthorised
    try:
        claims = decode_token(creds.credentials)
    except jwt.PyJWTError:
        raise unauthorised
    user = db.scalar(select(User).where(User.voter_id == claims.get("sub")))
    if user is None:  # deleted after the token was issued
        raise unauthorised
    return user  # role is read from the database, not trusted from the token


def admin_user(user: User = Depends(current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Administrator access required.")
    return user


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
api = APIRouter(prefix="/api")


@api.get("/health")
def health():
    with get_engine().connect() as conn:
        conn.execute(text("SELECT 1"))
    return {"status": "ok"}


@api.post("/signup", status_code=status.HTTP_201_CREATED)
def signup(body: SignupIn, db: Session = Depends(get_db)):
    if db.scalar(select(User).where(User.voter_id == body.voter_id)):
        raise HTTPException(status.HTTP_409_CONFLICT, "That voter ID is already registered.")
    # Public sign-up can only ever create ordinary voters. Admin accounts are created with
    # `python -m backend.create_admin`.
    db.add(User(voter_id=body.voter_id, password_hash=hash_password(body.password), role="user"))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "That voter ID is already registered.")
    return {"message": "Account created."}


@api.post("/login", response_model=TokenOut)
def login(body: LoginIn, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.voter_id == body.voter_id))
    if user is None:
        dummy_verify(body.password)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Voter ID or password is incorrect.")
    if not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Voter ID or password is incorrect.")
    return TokenOut(token=create_token(user.voter_id, user.role), role=user.role, voter_id=user.voter_id)


@api.get("/me", response_model=UserOut)
def me(user: User = Depends(current_user)):
    return _user_out(user)


@api.post("/change-password")
def change_password(body: ChangePasswordIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if not verify_password(body.old_password, user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Current password is incorrect.")
    user.password_hash = hash_password(body.new_password)
    db.add(user)
    db.commit()
    return {"message": "Password updated."}


@api.get("/voters", response_model=list[UserOut])
def list_voters(_: User = Depends(admin_user), db: Session = Depends(get_db)):
    return [_user_out(u) for u in db.scalars(select(User).order_by(User.created_at, User.id))]


@api.delete("/voters/{voter_id}")
def delete_voter(voter_id: str, admin: User = Depends(admin_user), db: Session = Depends(get_db)):
    if voter_id == admin.voter_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You can't remove your own account.")
    target = db.scalar(select(User).where(User.voter_id == voter_id))
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Voter not found.")
    db.delete(target)
    db.commit()
    return {"message": "Voter removed."}


app.include_router(api)

# The frontend is plain static files. Serving it from the same origin avoids CORS entirely.
# Mounted last so /api/* keeps priority.
if SRC_DIR.is_dir():
    app.mount("/", StaticFiles(directory=str(SRC_DIR), html=True), name="site")
