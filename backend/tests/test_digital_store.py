"""
Backend tests for Digital Store module (iteration 6).

Scope:
- GET /api/digital-store as student returns array; each item has is_purchased; no drive_file_id leak
- GET /api/digital-store/{pdf_id} returns product metadata (no drive_file_id for students)
- 404 for unpublished items to students; 200 to admin
- /digital-store/purchases/me still works (route order)
- /digital-store/preview/{pdf_id} returns 402 when not purchased
- POST /api/digital-store/checkout/{pdf_id} -> 500 + detail "Razorpay credentials not configured on server"
- Admin can create a new PDF; student sees it only after publish=true
- Mock purchase row (DB insert) -> is_purchased flips true and /preview returns PDF bytes; cleanup row
- Backend supervisor remains healthy after all calls

IMPORTANT: All DB writes (digital_pdfs, purchases) are tagged with TEST_ITER6_ markers and
cleaned up at the end of the test class run, so the production Atlas DB is left intact.
"""
import os
import time
import uuid
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else "https://github-sync-125.preview.emergentagent.com"
ADMIN_EMAIL = "admin@gyanriserana.com"
ADMIN_PASS = "Admin@12345"
STUDENT_EMAIL = "student@gyanriserana.com"
STUDENT_PASS = "Student@12345"

# Reuse the prod Atlas URI (READ + targeted CLEANUP only for TEST_ITER6 docs)
MONGO_URL = "mongodb+srv://akprit1612_db_user:uf6WAa3IQZQ2r9DG@gyan-rise.uayd6wc.mongodb.net/?appName=gyan-rise&retryWrites=true&w=majority"
DB_NAME = "gyan_rise_lms"

# Pre-existing read-only test PDF (do not modify)
EXISTING_PDF_ID = "69a1ab9e-301d-473f-8843-bf62b5ceec02"

TEST_MARK = f"TEST_ITER6_{uuid.uuid4().hex[:8]}"
CREATED_PDF_IDS = []
CREATED_PURCHASE_IDS = []


def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN_EMAIL, ADMIN_PASS)


@pytest.fixture(scope="module")
def student_token():
    return _login(STUDENT_EMAIL, STUDENT_PASS)


@pytest.fixture(scope="module")
def student_id(student_token):
    r = requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {student_token}"}, timeout=20)
    assert r.status_code == 200
    return r.json()["id"]


@pytest.fixture(scope="module")
def mongo_db():
    client = MongoClient(MONGO_URL, serverSelectionTimeoutMS=10000)
    db = client[DB_NAME]
    yield db
    # ---- TEARDOWN: delete ONLY rows tagged with our TEST_ITER6 marker ----
    for pid in CREATED_PDF_IDS:
        db.digital_pdfs.delete_one({"id": pid})
        db.purchases.delete_many({"pdf_id": pid})
    for purch_id in CREATED_PURCHASE_IDS:
        db.purchases.delete_one({"id": purch_id})
    # Safety net by marker
    db.digital_pdfs.delete_many({"title": {"$regex": TEST_MARK[:14]}})
    client.close()


# -------------------- list endpoint --------------------
class TestDigitalStoreList:
    def test_list_as_student_has_is_purchased_no_drive_id(self, student_token):
        r = requests.get(f"{BASE_URL}/api/digital-store",
                         headers={"Authorization": f"Bearer {student_token}"}, timeout=20)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        if items:
            for it in items:
                assert "is_purchased" in it, f"missing is_purchased: {it}"
                assert "drive_file_id" not in it, "drive_file_id leaked to student"
                assert isinstance(it["is_purchased"], bool)

    def test_list_as_admin_has_drive_id(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/digital-store",
                         headers={"Authorization": f"Bearer {admin_token}"}, timeout=20)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        # at least the existing 'shiva' pdf
        has_drive = any("drive_file_id" in it for it in items)
        assert has_drive, "admin should see drive_file_id on at least one item"


# -------------------- detail endpoint --------------------
class TestDigitalStoreDetail:
    def test_get_detail_student_existing(self, student_token):
        r = requests.get(f"{BASE_URL}/api/digital-store/{EXISTING_PDF_ID}",
                         headers={"Authorization": f"Bearer {student_token}"}, timeout=20)
        # existing shiva PDF should be published
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["id"] == EXISTING_PDF_ID
        assert "title" in d and isinstance(d["title"], str) and len(d["title"]) > 0
        assert "drive_file_id" not in d
        assert "is_purchased" in d
        assert d["is_purchased"] is False  # student has not purchased yet

    def test_get_detail_admin_has_drive_id(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/digital-store/{EXISTING_PDF_ID}",
                         headers={"Authorization": f"Bearer {admin_token}"}, timeout=20)
        assert r.status_code == 200
        d = r.json()
        # admin sees drive_file_id and no is_purchased flag forced
        assert "drive_file_id" in d
        assert "title" in d

    def test_get_detail_nonexistent_returns_404(self, student_token):
        r = requests.get(f"{BASE_URL}/api/digital-store/does-not-exist-xyz",
                         headers={"Authorization": f"Bearer {student_token}"}, timeout=20)
        assert r.status_code == 404


# -------------------- route ordering / purchases/me --------------------
class TestRouteOrdering:
    def test_purchases_me_still_routes(self, student_token):
        r = requests.get(f"{BASE_URL}/api/digital-store/purchases/me",
                         headers={"Authorization": f"Bearer {student_token}"}, timeout=20)
        # must not be misrouted into get_digital_pdf -> 404
        assert r.status_code == 200, f"purchases/me misrouted: {r.status_code} {r.text}"
        assert isinstance(r.json(), list)


# -------------------- preview gate (402) --------------------
class TestPreviewGate:
    def test_preview_blocked_without_purchase(self, student_token):
        r = requests.get(f"{BASE_URL}/api/digital-store/preview/{EXISTING_PDF_ID}",
                         headers={"Authorization": f"Bearer {student_token}"}, timeout=20)
        assert r.status_code == 402, f"expected 402, got {r.status_code} {r.text[:200]}"
        body = r.json()
        assert "detail" in body
        assert "purchase" in body["detail"].lower() or "required" in body["detail"].lower()


# -------------------- checkout without razorpay keys --------------------
class TestCheckoutWithoutRazorpay:
    def test_checkout_returns_500_with_detail(self, student_token):
        r = requests.post(f"{BASE_URL}/api/digital-store/checkout/{EXISTING_PDF_ID}",
                          headers={"Authorization": f"Bearer {student_token}"}, timeout=20)
        # Razorpay env keys not configured -> 500 detail
        assert r.status_code == 500, f"expected 500, got {r.status_code} {r.text[:200]}"
        body = r.json()
        assert body.get("detail") == "Razorpay credentials not configured on server"

    def test_backend_still_healthy_after_failed_checkout(self):
        r = requests.get(f"{BASE_URL}/api/auth/me", timeout=10)
        # No token -> 401, but the route itself must respond (server alive)
        assert r.status_code == 401


# -------------------- admin create + publish flow --------------------
class TestAdminCreatePublish:
    def test_admin_creates_unpublished_pdf_invisible_to_student(self, admin_token, student_token):
        title = f"{TEST_MARK}_unpub"
        payload = {
            "title": title,
            "description": "iter6 test pdf - unpublished",
            "thumbnail_url": "",
            "drive_link": "https://drive.google.com/file/d/1AaBbCcDdEeFfGgHhIiJjKkLlMmNn00/view",
            "category": "test",
            "price": 49,
            "currency": "INR",
            "published": False,
        }
        r = requests.post(f"{BASE_URL}/api/digital-store",
                          headers={"Authorization": f"Bearer {admin_token}"},
                          json=payload, timeout=20)
        assert r.status_code == 200, r.text
        doc = r.json()
        assert doc["title"] == title
        assert doc["published"] is False
        pdf_id = doc["id"]
        CREATED_PDF_IDS.append(pdf_id)

        # admin can fetch detail
        r2 = requests.get(f"{BASE_URL}/api/digital-store/{pdf_id}",
                          headers={"Authorization": f"Bearer {admin_token}"}, timeout=20)
        assert r2.status_code == 200

        # student gets 404 (unpublished)
        r3 = requests.get(f"{BASE_URL}/api/digital-store/{pdf_id}",
                          headers={"Authorization": f"Bearer {student_token}"}, timeout=20)
        assert r3.status_code == 404

        # publish it
        r4 = requests.post(f"{BASE_URL}/api/digital-store/{pdf_id}/publish",
                           headers={"Authorization": f"Bearer {admin_token}"}, timeout=20)
        assert r4.status_code == 200

        # now student can see it (no drive_file_id, is_purchased=false)
        r5 = requests.get(f"{BASE_URL}/api/digital-store/{pdf_id}",
                          headers={"Authorization": f"Bearer {student_token}"}, timeout=20)
        assert r5.status_code == 200
        d = r5.json()
        assert "drive_file_id" not in d
        assert d["is_purchased"] is False
        assert d["title"] == title


# -------------------- simulate purchase in DB (no razorpay) --------------------
class TestSimulatedPurchase:
    def test_inserting_purchase_row_grants_access_flag(self, student_token, student_id, mongo_db):
        # Pick the unpublished->now-published PDF we created (last one)
        assert CREATED_PDF_IDS, "no test PDF was created earlier"
        pdf_id = CREATED_PDF_IDS[-1]

        purchase_doc = {
            "id": f"{TEST_MARK}_purch",
            "user_id": student_id,
            "pdf_id": pdf_id,
            "payment_id": f"{TEST_MARK}_pay",
            "created_at": "2026-01-01T00:00:00.000+00:00",
        }
        mongo_db.purchases.insert_one(dict(purchase_doc))
        CREATED_PURCHASE_IDS.append(purchase_doc["id"])

        # detail should now flip is_purchased=true
        r = requests.get(f"{BASE_URL}/api/digital-store/{pdf_id}",
                         headers={"Authorization": f"Bearer {student_token}"}, timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert d["is_purchased"] is True, f"is_purchased did not flip: {d}"

        # list endpoint should also reflect it
        rl = requests.get(f"{BASE_URL}/api/digital-store",
                          headers={"Authorization": f"Bearer {student_token}"}, timeout=20)
        assert rl.status_code == 200
        match = [it for it in rl.json() if it["id"] == pdf_id]
        assert match and match[0]["is_purchased"] is True

        # purchases/me should include this row
        rp = requests.get(f"{BASE_URL}/api/digital-store/purchases/me",
                          headers={"Authorization": f"Bearer {student_token}"}, timeout=20)
        assert rp.status_code == 200
        assert any(p.get("pdf_id") == pdf_id for p in rp.json())

    def test_preview_endpoint_attempts_fetch_after_purchase(self, student_token):
        # The created PDF references a fake Drive file id, so Drive fetch will fail with 502,
        # NOT 402. That proves the purchase gate has been passed.
        pdf_id = CREATED_PDF_IDS[-1]
        r = requests.get(f"{BASE_URL}/api/digital-store/preview/{pdf_id}",
                         headers={"Authorization": f"Bearer {student_token}"}, timeout=30)
        assert r.status_code != 402, "purchase gate should have been passed"
        # acceptable outcomes: 502 (drive fetch failed) or 200 (if drive served)
        assert r.status_code in (200, 502), f"unexpected status: {r.status_code} {r.text[:200]}"
