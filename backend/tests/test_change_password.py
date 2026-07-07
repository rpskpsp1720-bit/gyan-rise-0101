"""Tests for POST /api/auth/change-password (iteration 7).

Covers:
- Auth gating (no token / wrong current password)
- Pydantic validation (new_password min_length=6)
- Business rule: new_password must differ from current
- Happy path for admin AND student temp users (DB-inserted, cleaned up)
- Login works with new password / fails with old
- Regression: existing forgot/reset/login/me/logout endpoints still work
- Regression: production user password_hashes untouched
- bcrypt hash format ($2b$) preserved
"""
import os
import uuid
import pytest
import requests
import bcrypt
from pymongo import MongoClient
from dotenv import load_dotenv
from pathlib import Path

# Load backend .env so MONGO_URL/DB_NAME are available when pytest runs from /app
load_dotenv(Path("/app/backend/.env"))
load_dotenv(Path("/app/frontend/.env"))

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]

API = f"{BASE_URL}/api"

# Production user to snapshot for regression (seeded admin)
SNAPSHOT_EMAIL = "admin@gyanriserana.com"


# ---------- Mongo / fixtures ----------

@pytest.fixture(scope="session")
def mongo_db():
    client = MongoClient(MONGO_URL, serverSelectionTimeoutMS=10000)
    yield client[DB_NAME]
    client.close()


def _hash(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def _make_user(mongo_db, role: str, password: str) -> dict:
    uid = str(uuid.uuid4())
    email = f"test_{role}_{uid[:8]}@pytest-gyanrise.com"
    doc = {
        "id": uid,
        "email": email,
        "name": f"TEST {role}",
        "role": role,
        "password_hash": _hash(password),
    }
    mongo_db.users.insert_one(doc)
    return {"id": uid, "email": email, "password": password}


def _delete_user(mongo_db, user_id: str):
    mongo_db.users.delete_one({"id": user_id})


def _login(email: str, password: str) -> requests.Response:
    # fresh session — never reuse cookies between login attempts
    s = requests.Session()
    return s.post(f"{API}/auth/login", json={"email": email, "password": password})


def _bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ---------- Snapshot of production user (regression safety) ----------

@pytest.fixture(scope="module")
def prod_hash_snapshot(mongo_db):
    u = mongo_db.users.find_one({"email": SNAPSHOT_EMAIL})
    if not u:
        pytest.skip(f"snapshot user {SNAPSHOT_EMAIL} not present")
    snap = u.get("password_hash")
    yield snap
    after = mongo_db.users.find_one({"email": SNAPSHOT_EMAIL}).get("password_hash")
    assert after == snap, "Production admin password_hash was modified during tests!"


# ---------- Negative auth/validation tests (no DB writes needed) ----------

class TestChangePasswordValidation:

    def test_no_token_returns_401(self):
        r = requests.post(
            f"{API}/auth/change-password",
            json={"current_password": "x", "new_password": "abcdef"},
        )
        assert r.status_code == 401, r.text

    def test_short_new_password_returns_422(self, mongo_db):
        # need a valid token to even reach pydantic? No — pydantic runs first on body.
        u = _make_user(mongo_db, "student", "OrigPass123")
        try:
            login = _login(u["email"], u["password"])
            assert login.status_code == 200
            token = login.json()["token"]
            r = requests.post(
                f"{API}/auth/change-password",
                json={"current_password": u["password"], "new_password": "abc"},
                headers=_bearer(token),
            )
            assert r.status_code == 422, r.text
        finally:
            _delete_user(mongo_db, u["id"])

    def test_wrong_current_password_returns_401(self, mongo_db):
        u = _make_user(mongo_db, "student", "OrigPass123")
        try:
            login = _login(u["email"], u["password"])
            token = login.json()["token"]
            r = requests.post(
                f"{API}/auth/change-password",
                json={"current_password": "WRONG_PASS", "new_password": "BrandNew123"},
                headers=_bearer(token),
            )
            assert r.status_code == 401, r.text
            assert "current password is incorrect" in r.json()["detail"].lower()
        finally:
            _delete_user(mongo_db, u["id"])

    def test_new_equal_to_current_returns_400(self, mongo_db):
        u = _make_user(mongo_db, "student", "SamePass123")
        try:
            login = _login(u["email"], u["password"])
            token = login.json()["token"]
            r = requests.post(
                f"{API}/auth/change-password",
                json={"current_password": u["password"], "new_password": u["password"]},
                headers=_bearer(token),
            )
            assert r.status_code == 400, r.text
            assert "different" in r.json()["detail"].lower()
        finally:
            _delete_user(mongo_db, u["id"])


# ---------- Happy path: admin + student ----------

class TestChangePasswordHappyPath:

    @pytest.mark.parametrize("role", ["admin", "student"])
    def test_happy_path(self, mongo_db, role, prod_hash_snapshot):
        original_pw = "OldPass#1A"
        new_pw = "NewPass#2B"
        u = _make_user(mongo_db, role, original_pw)
        try:
            # 1. Login with original
            login = _login(u["email"], original_pw)
            assert login.status_code == 200, login.text
            token = login.json()["token"]
            assert login.json()["user"]["role"] == role

            # 2. Change password
            r = requests.post(
                f"{API}/auth/change-password",
                json={"current_password": original_pw, "new_password": new_pw},
                headers=_bearer(token),
            )
            assert r.status_code == 200, r.text
            body = r.json()
            assert body.get("ok") is True
            assert "successfully" in body.get("message", "").lower()

            # 3. Verify bcrypt hash format in DB
            db_user = mongo_db.users.find_one({"id": u["id"]})
            assert db_user["password_hash"].startswith("$2b$"), db_user["password_hash"][:10]
            # And the stored hash actually verifies the new password
            assert bcrypt.checkpw(new_pw.encode(), db_user["password_hash"].encode())
            assert not bcrypt.checkpw(original_pw.encode(), db_user["password_hash"].encode())

            # 4. Login with NEW password — 200
            login_new = _login(u["email"], new_pw)
            assert login_new.status_code == 200, login_new.text
            assert login_new.json()["token"]

            # 5. Login with OLD password — 401
            login_old = _login(u["email"], original_pw)
            assert login_old.status_code == 401, login_old.text
        finally:
            _delete_user(mongo_db, u["id"])


# ---------- Regression: existing endpoints still work ----------

class TestRegression:

    def test_forgot_password_returns_200_for_any_email(self):
        r = requests.post(
            f"{API}/auth/forgot-password",
            json={"email": "does_not_exist_xyz@pytest-gyanrise.com"},
        )
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True

    def test_reset_password_invalid_token_returns_400(self):
        r = requests.post(
            f"{API}/auth/reset-password",
            json={"token": "definitely-not-a-real-token", "new_password": "Whatever123"},
        )
        assert r.status_code == 400, r.text

    def test_login_me_logout_still_work(self, mongo_db):
        u = _make_user(mongo_db, "student", "RegPass123")
        try:
            s = requests.Session()
            login = s.post(f"{API}/auth/login", json={"email": u["email"], "password": u["password"]})
            assert login.status_code == 200, login.text
            token = login.json()["token"]

            me = requests.get(f"{API}/auth/me", headers=_bearer(token))
            assert me.status_code == 200, me.text
            assert me.json()["email"] == u["email"]
            assert "password_hash" not in me.json()

            logout = s.post(f"{API}/auth/logout")
            assert logout.status_code == 200, logout.text
        finally:
            _delete_user(mongo_db, u["id"])

    def test_login_unaffected_after_change_password(self, mongo_db, prod_hash_snapshot):
        # the snapshot fixture asserts admin hash unchanged at teardown
        login = _login(SNAPSHOT_EMAIL, "Admin@12345")
        assert login.status_code == 200, login.text
        assert login.json()["user"]["role"] == "admin"
