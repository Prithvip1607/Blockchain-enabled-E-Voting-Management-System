from sqlalchemy import select

from backend.database import User
from backend.database import db as dbmod


def signup(client, vid="voter001", pw="secret123"):
    return client.post("/api/signup", json={"voter_id": vid, "password": pw})


def login(client, vid="voter001", pw="secret123"):
    return client.post("/api/login", json={"voter_id": vid, "password": pw})


def auth(client, vid="voter001", pw="secret123"):
    return {"Authorization": f"Bearer {login(client, vid, pw).json()['token']}"}


def test_signup_and_login(client):
    assert signup(client).status_code == 201
    r = login(client)
    assert r.status_code == 200
    body = r.json()
    assert body["role"] == "user" and body["voter_id"] == "voter001" and body["token"]


def test_password_is_hashed_not_plaintext(client):
    signup(client, pw="secret123")
    with dbmod._SessionLocal() as s:
        u = s.scalar(select(User).where(User.voter_id == "voter001"))
    assert u.password_hash != "secret123"
    assert u.password_hash.startswith("$2")  # bcrypt


def test_duplicate_signup_conflicts(client):
    signup(client)
    assert signup(client).status_code == 409


def test_signup_validation(client):
    assert signup(client, vid="ab").status_code == 422           # too short
    assert signup(client, vid="has space").status_code == 422    # whitespace
    assert signup(client, pw="12345").status_code == 422         # too short
    assert signup(client, pw="x" * 73).status_code == 422        # over bcrypt limit


def test_signup_cannot_create_admin(client):
    r = client.post("/api/signup", json={"voter_id": "sneaky", "password": "secret123", "role": "admin"})
    assert r.status_code == 201
    assert login(client, "sneaky").json()["role"] == "user"


def test_bad_credentials_share_one_message(client):
    signup(client)
    wrong_pw = login(client, pw="nope-nope")
    unknown = login(client, vid="ghost")
    assert wrong_pw.status_code == unknown.status_code == 401
    assert wrong_pw.json()["detail"] == unknown.json()["detail"]


def test_me_requires_a_valid_token(client):
    signup(client)
    assert client.get("/api/me").status_code == 401
    assert client.get("/api/me", headers={"Authorization": "Bearer garbage"}).status_code == 401
    r = client.get("/api/me", headers=auth(client))
    assert r.status_code == 200 and r.json()["voter_id"] == "voter001"


def test_change_password(client):
    signup(client)
    h = auth(client)
    bad = client.post("/api/change-password", headers=h, json={"old_password": "wrong", "new_password": "newsecret1"})
    assert bad.status_code == 400
    ok = client.post("/api/change-password", headers=h, json={"old_password": "secret123", "new_password": "newsecret1"})
    assert ok.status_code == 200
    assert login(client).status_code == 401
    assert login(client, pw="newsecret1").status_code == 200


def test_voter_list_is_admin_only(client, make_admin):
    signup(client)
    assert client.get("/api/voters").status_code == 401
    assert client.get("/api/voters", headers=auth(client)).status_code == 403
    admin = make_admin()
    r = client.get("/api/voters", headers=admin)
    assert r.status_code == 200
    ids = {v["voter_id"] for v in r.json()}
    assert ids == {"voter001", "admin1"}
    assert all("password" not in v and "password_hash" not in v for v in r.json())


def test_admin_can_delete_voter_but_not_self(client, make_admin):
    signup(client)
    admin = make_admin()
    assert client.delete("/api/voters/voter001", headers=auth(client)).status_code == 403
    assert client.delete("/api/voters/admin1", headers=admin).status_code == 400
    assert client.delete("/api/voters/nobody", headers=admin).status_code == 404
    assert client.delete("/api/voters/voter001", headers=admin).status_code == 200
    assert login(client).status_code == 401


def test_deleted_user_token_stops_working(client, make_admin):
    signup(client)
    voter = auth(client)
    admin = make_admin()
    client.delete("/api/voters/voter001", headers=admin)
    assert client.get("/api/me", headers=voter).status_code == 401


def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}


def test_security_headers(client):
    r = client.get("/api/health")
    assert r.headers["X-Content-Type-Options"] == "nosniff"
    assert "frame-ancestors 'none'" in r.headers["Content-Security-Policy"]
