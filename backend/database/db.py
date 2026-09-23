"""Database layer (MySQL via SQLAlchemy).

Stores OFF-CHAIN application data only: user accounts. Election, candidate and vote data
lives in the Solidity contract on Ethereum Sepolia, never here.
"""
from __future__ import annotations

import os
from datetime import datetime
from typing import Iterator, Optional

from sqlalchemy import DateTime, String, create_engine, func
from sqlalchemy.engine import URL
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker
from sqlalchemy.pool import StaticPool


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    voter_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))  # bcrypt hash, never the password
    role: Mapped[str] = mapped_column(String(16), default="user")  # "user" or "admin"
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


_engine = None
_SessionLocal: Optional[sessionmaker] = None


def database_url() -> str | URL:
    explicit = os.getenv("DATABASE_URL")
    if explicit:
        return explicit
    return URL.create(
        "mysql+pymysql",
        username=os.getenv("MYSQL_USER", "chainvote"),
        password=os.getenv("MYSQL_PASSWORD") or None,
        host=os.getenv("MYSQL_HOST", "127.0.0.1"),
        port=int(os.getenv("MYSQL_PORT", "3306")),
        database=os.getenv("MYSQL_DATABASE", "chainvote"),
        query={"charset": "utf8mb4"},
    )


def init_db(url: str | URL | None = None) -> None:
    """Create the engine and the tables. Safe to call more than once."""
    global _engine, _SessionLocal
    url = url or database_url()
    kwargs: dict = {"pool_pre_ping": True}
    if str(url) in ("sqlite://", "sqlite:///:memory:") or str(url).startswith("sqlite+pysqlite://"):
        kwargs = {"connect_args": {"check_same_thread": False}, "poolclass": StaticPool}
    _engine = create_engine(url, **kwargs)
    _SessionLocal = sessionmaker(bind=_engine, autoflush=False, expire_on_commit=False)
    Base.metadata.create_all(_engine)


def get_engine():
    if _engine is None:
        init_db()
    return _engine


def get_db() -> Iterator[Session]:
    if _SessionLocal is None:
        init_db()
    db = _SessionLocal()  # type: ignore[misc]
    try:
        yield db
    finally:
        db.close()
