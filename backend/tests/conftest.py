import os

# Must be set before the app is imported.
os.environ["JWT_SECRET"] = "test-secret-test-secret-test-secret-1234"
os.environ["DATABASE_URL"] = "sqlite://"

import pytest
from fastapi.testclient import TestClient

from backend.database import Base, User, init_db
from backend.database import db as dbmod
from backend.main import app
from backend.security import hash_password


@pytest.fixture()
def client():
    init_db("sqlite://")
    Base.metadata.drop_all(dbmod._engine)
    Base.metadata.create_all(dbmod._engine)
    return TestClient(app)


@pytest.fixture()
def make_admin(client):
    def _make(voter_id="admin1", password="adminpass1"):
        with dbmod._SessionLocal() as s:
            s.add(User(voter_id=voter_id, password_hash=hash_password(password), role="admin"))
            s.commit()
        token = client.post("/api/login", json={"voter_id": voter_id, "password": password}).json()["token"]
        return {"Authorization": f"Bearer {token}"}

    return _make
