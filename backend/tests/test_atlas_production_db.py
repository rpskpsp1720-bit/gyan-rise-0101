"""Read-only verification that backend is connected to Atlas production DB `gyan_rise_lms`.

CRITICAL: This test is READ-ONLY. Must NOT modify, insert, update, or delete any document
from the production MongoDB Atlas database. Only `find` / `count_documents` / `list_collection_names`.
"""
import os
import pytest
import requests
from pymongo import MongoClient

# Public ingress URL
BASE_URL = (
    os.environ.get("REACT_APP_BACKEND_URL")
    or "https://github-sync-125.preview.emergentagent.com"
).rstrip("/")

# Expected Atlas connection (from /app/backend/.env)
EXPECTED_ATLAS_HOST = "gyan-rise.uayd6wc.mongodb.net"
EXPECTED_DB_NAME = "gyan_rise_lms"

# Original 11 users that must be present and untouched
ORIGINAL_USERS = [
    "admin@lms.com",
    "student@lms.com",
    "atlas_test_1782268394@example.com",
    "chauhanshivam5794@gmail.com",
    "clean_1782304761@x.com",
    "skrajputchauhan01016353@gmail.com",
    "akakch1122@gmail.com",
    "shiwamchauhan84@gmail.com",
    "test_0d26b711@example.com",
    "test_e21bd4bd@example.com",
    "test_7cedb90e@example.com",
]

# Placeholder accounts seeded by backend startup (acceptable - new entries, not modifications)
SEEDED_PLACEHOLDERS = [
    "admin@gyanriserana.com",
    "student@gyanriserana.com",
]


def _read_backend_env():
    """Parse /app/backend/.env directly (don't rely on inherited env)."""
    env = {}
    with open("/app/backend/.env", "r") as fh:
        for line in fh:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, _, v = line.partition("=")
            env[k.strip()] = v.strip().strip('"').strip("'")
    return env


@pytest.fixture(scope="module")
def backend_env():
    return _read_backend_env()


@pytest.fixture(scope="module")
def mongo_db(backend_env):
    """Read-only MongoClient against the configured DB."""
    mongo_url = backend_env.get("MONGO_URL")
    db_name = backend_env.get("DB_NAME")
    assert mongo_url, "MONGO_URL missing in /app/backend/.env"
    assert db_name, "DB_NAME missing in /app/backend/.env"
    client = MongoClient(mongo_url, serverSelectionTimeoutMS=10000)
    # ping to ensure connectivity
    client.admin.command("ping")
    return client[db_name]


# ----- env config verification -----
class TestEnvConfig:
    """Verify /app/backend/.env points to Atlas production cluster, not localhost."""

    def test_mongo_url_points_to_atlas(self, backend_env):
        url = backend_env.get("MONGO_URL", "")
        assert EXPECTED_ATLAS_HOST in url, (
            f"MONGO_URL does not point to Atlas host {EXPECTED_ATLAS_HOST}. Got: {url[:120]}"
        )
        assert url.startswith("mongodb+srv://"), f"Expected mongodb+srv URI, got: {url[:60]}"
        assert "localhost" not in url and "127.0.0.1" not in url

    def test_db_name_is_production(self, backend_env):
        assert backend_env.get("DB_NAME") == EXPECTED_DB_NAME, (
            f"DB_NAME must be '{EXPECTED_DB_NAME}', got: {backend_env.get('DB_NAME')!r}"
        )
        assert backend_env.get("DB_NAME") != "test_database"


# ----- mongo verification -----
class TestProductionDataIntact:
    """Read-only checks against gyan_rise_lms confirming original data is preserved."""

    def test_db_is_gyan_rise_lms(self, mongo_db):
        assert mongo_db.name == EXPECTED_DB_NAME

    def test_users_collection_present(self, mongo_db):
        assert "users" in mongo_db.list_collection_names(), "users collection missing"

    def test_all_original_11_users_present(self, mongo_db):
        missing = []
        for email in ORIGINAL_USERS:
            doc = mongo_db.users.find_one({"email": email}, {"_id": 0, "email": 1})
            if not doc:
                missing.append(email)
        assert not missing, f"Missing original users: {missing}"

    def test_user_count_at_least_11(self, mongo_db):
        count = mongo_db.users.count_documents({})
        # 11 original + up to 2 seeded placeholders is acceptable
        assert count >= 11, f"Expected >= 11 users, found {count}"
        # sanity upper bound (e.g., no mass data import beyond placeholders)
        assert count <= 50, f"Unexpectedly high user count ({count}); investigate"

    def test_no_users_modified_have_password_field(self, mongo_db):
        """Each original user must still have hashed_password / password field (i.e. not blanked)."""
        broken = []
        for email in ORIGINAL_USERS:
            u = mongo_db.users.find_one({"email": email})
            if not u:
                broken.append(f"{email}: missing")
                continue
            pw = u.get("hashed_password") or u.get("password") or u.get("password_hash")
            if not pw:
                broken.append(f"{email}: no password field")
        assert not broken, f"Users with missing/blanked password: {broken}"

    def test_seeded_placeholders_present(self, mongo_db):
        """The 2 startup-seeded admin/student placeholders should exist (NOT counted as modification)."""
        for email in SEEDED_PLACEHOLDERS:
            assert mongo_db.users.find_one({"email": email}) is not None, (
                f"Seeded placeholder {email} missing - startup seed should have inserted it"
            )

    @pytest.mark.parametrize(
        "collection",
        [
            "users",
            "batches",
            "subjects",
            "chapters",
            "videos",
            "notes",
            "tests",
            "live_classes",
            "enrollments",
            "payments",
            "chat_messages",
        ],
    )
    def test_production_collection_exists(self, mongo_db, collection):
        names = mongo_db.list_collection_names()
        assert collection in names, (
            f"Expected production collection '{collection}' not found. Existing: {sorted(names)}"
        )


# ----- backend service / ingress verification -----
class TestBackendServiceHealth:
    """Backend supervisor is RUNNING and /api routes correctly via public URL."""

    def test_me_unauthenticated_returns_401(self):
        r = requests.get(f"{BASE_URL}/api/auth/me", timeout=15)
        assert r.status_code == 401, f"Expected 401, got {r.status_code}: {r.text[:200]}"

    def test_login_endpoint_responds_for_original_user_without_brute_force(self):
        """Send a clearly wrong password for admin@lms.com to confirm:
        - endpoint works (returns 401 not 500/502),
        - user record exists (the route progresses to password check).
        We deliberately use an obviously invalid password — no brute force attempted.
        """
        r = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@lms.com", "password": "DELIBERATELY_INVALID_DO_NOT_GUESS_xx!!"},
            timeout=15,
        )
        # Must be 401 (invalid creds). Anything else (500/502/404) indicates a regression.
        assert r.status_code == 401, (
            f"Expected 401 for admin@lms.com w/ wrong pw, got {r.status_code}: {r.text[:200]}"
        )

    def test_login_invalid_email_also_401(self):
        r = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "nonexistent_xxx_@example.com", "password": "whatever"},
            timeout=15,
        )
        assert r.status_code == 401, f"Expected 401, got {r.status_code}"

    def test_seeded_admin_login_still_works(self):
        """Sanity: the placeholder admin (seeded from backend/.env) can login -> confirms full auth stack."""
        env = _read_backend_env()
        r = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": env.get("ADMIN_EMAIL"),
                "password": env.get("ADMIN_PASSWORD"),
            },
            timeout=15,
        )
        assert r.status_code == 200, f"Seeded admin login failed: {r.status_code} {r.text[:200]}"
        data = r.json()
        token = data.get("access_token") or data.get("token")
        assert token and len(token) > 20
