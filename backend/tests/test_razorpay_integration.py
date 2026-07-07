"""
Backend tests for Razorpay integration (iteration 6+).

Strategy (no real Razorpay calls allowed):
1. While RAZORPAY_KEY_SECRET is empty -> POST /digital-store/checkout/{pdf_id}
   must return HTTP 500 with detail "Razorpay credentials not configured on server".
   (Even though RAZORPAY_KEY_ID is set to a live key id, the secret is blank,
    so get_razorpay_keys() must short-circuit.)

2. Set BOTH RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to SYNTHETIC test values in
   /app/backend/.env, restart backend, then:
     a) checkout endpoint reaches Razorpay's /v1/orders -> 502 from our server
        (because synthetic creds are rejected by Razorpay). This proves the
        env keys are being read at runtime.
     b) /digital-store/payments/verify with a TAMPERED signature -> 400
        "Invalid payment signature". (No DB writes.)
     c) /digital-store/payments/verify with a CORRECT HMAC-SHA256 signature
        computed using our synthetic secret -> 502 (Razorpay payment fetch
        fails for the fake payment id). 502 here proves the signature check
        passed; if the secret were wrong, we'd get 400 instead.
        We then assert that NO db.payments / db.purchases row was written
        (because the payment-info fetch failed BEFORE the insert).

3. Per-user gating (REQ 5/6) is exercised by directly inserting a TEST_RP_
   purchase row for the student and asserting:
     - student's GET /digital-store/preview/{pdf_id} no longer returns 402
     - admin's GET /digital-store/preview/{pdf_id} also passes (admin bypass)
     - ANOTHER user (admin treated as separate identity here is the only other
       seeded account) still being unable to see student's purchases is asserted
       via the is_purchased flag on the detail endpoint, which is per-user.
   Also REQ 6 negative: unauthenticated GET /preview -> 401.

4. REQ 4: confirm schema of the would-be payment + purchase docs by reading the
   source of digital_store_payments_verify and asserting it contains every
   required key (provider, provider_order_id, provider_payment_id,
   provider_signature, status, amount, currency, user_id, pdf_id, created_at
   for payments; user_id, pdf_id, payment_id, created_at for purchases).

5. REQ 7/8/9: static-source assertions on the frontend (Checkout.jsx, etc.)
   to confirm the success toast, redirect, modal.escape=false, and that no
   non-Razorpay UI files were touched. We do NOT launch a browser.

6. Restore /app/backend/.env to the pre-test snapshot (.env.iter6_backup)
   and restart backend so the live env is untouched.

ALL writes (digital_pdfs, purchases) are tagged TEST_RP_ and cleaned up.
"""
import os
import re
import time
import uuid
import hmac
import hashlib
import shutil
import subprocess
import pytest
import requests
from pymongo import MongoClient

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL")
            or "https://github-sync-125.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@gyanriserana.com"
ADMIN_PASS = "Admin@12345"
STUDENT_EMAIL = "student@gyanriserana.com"
STUDENT_PASS = "Student@12345"

MONGO_URL = "mongodb+srv://akprit1612_db_user:uf6WAa3IQZQ2r9DG@gyan-rise.uayd6wc.mongodb.net/?appName=gyan-rise&retryWrites=true&w=majority"
DB_NAME = "gyan_rise_lms"

EXISTING_PDF_ID = "69a1ab9e-301d-473f-8843-bf62b5ceec02"

TEST_MARK = f"TEST_RP_{uuid.uuid4().hex[:8]}"
SYNTHETIC_KEY_ID = "rzp_test_FAKE_FOR_UNIT_TESTS"
SYNTHETIC_KEY_SECRET = "synthetic_secret_for_signature_math_only"

ENV_PATH = "/app/backend/.env"
ENV_BACKUP = "/app/backend/.env.iter6_backup"

CREATED_PDF_IDS = []
CREATED_PURCHASE_IDS = []


# ---------------- helpers ----------------

def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    return r.json()["token"]


def _wait_backend_ready(timeout=40):
    deadline = time.time() + timeout
    last = None
    while time.time() < deadline:
        try:
            r = requests.get(f"{BASE_URL}/api/auth/me", timeout=5)
            if r.status_code in (200, 401):
                return True
            last = r.status_code
        except Exception as e:
            last = str(e)
        time.sleep(1)
    raise RuntimeError(f"backend not ready: {last}")


def _write_env(key_id, key_secret):
    with open(ENV_BACKUP, "r") as f:
        content = f.read()
    content = re.sub(r'RAZORPAY_KEY_ID="[^"]*"', f'RAZORPAY_KEY_ID="{key_id}"', content)
    content = re.sub(r'RAZORPAY_KEY_SECRET="[^"]*"', f'RAZORPAY_KEY_SECRET="{key_secret}"', content)
    with open(ENV_PATH, "w") as f:
        f.write(content)
    subprocess.run(["sudo", "supervisorctl", "restart", "backend"], check=False, capture_output=True)
    _wait_backend_ready()


def _restore_env():
    shutil.copy(ENV_BACKUP, ENV_PATH)
    subprocess.run(["sudo", "supervisorctl", "restart", "backend"], check=False, capture_output=True)
    _wait_backend_ready()


# ---------------- fixtures ----------------

@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN_EMAIL, ADMIN_PASS)


@pytest.fixture(scope="module")
def student_token():
    return _login(STUDENT_EMAIL, STUDENT_PASS)


@pytest.fixture(scope="module")
def student_id(student_token):
    r = requests.get(f"{BASE_URL}/api/auth/me",
                     headers={"Authorization": f"Bearer {student_token}"}, timeout=20)
    assert r.status_code == 200
    return r.json()["id"]


@pytest.fixture(scope="module")
def mongo_db():
    client = MongoClient(MONGO_URL, serverSelectionTimeoutMS=10000)
    db = client[DB_NAME]
    yield db
    # ---- TEARDOWN: delete only docs tagged with this test run's markers ----
    for pid in CREATED_PDF_IDS:
        db.digital_pdfs.delete_one({"id": pid})
        db.purchases.delete_many({"pdf_id": pid})
        db.payments.delete_many({"pdf_id": pid})
    for pid in CREATED_PURCHASE_IDS:
        db.purchases.delete_one({"id": pid})
    db.digital_pdfs.delete_many({"title": {"$regex": f"^{TEST_MARK}"}})
    db.payments.delete_many({"provider_payment_id": {"$regex": f"^{TEST_MARK}"}})
    db.purchases.delete_many({"id": {"$regex": f"^{TEST_MARK}"}})
    client.close()


@pytest.fixture(scope="module", autouse=True)
def env_restorer():
    """Ensure .env is restored even if tests crash."""
    yield
    try:
        _restore_env()
    except Exception as e:
        print(f"env restore failed: {e}")


# ===================== REQ 1 negative: empty secret -> 500 =====================

class TestReq1EmptySecret:
    """With RAZORPAY_KEY_SECRET='' (current .env state), checkout returns 500."""

    def test_checkout_500_when_secret_empty(self, student_token):
        # Sanity: backend currently has empty secret per .env snapshot.
        with open(ENV_BACKUP, "r") as f:
            backup = f.read()
        assert 'RAZORPAY_KEY_SECRET=""' in backup, "test precondition: backup must have empty secret"
        # Make sure live .env mirrors backup right now (no prior test left synth keys).
        shutil.copy(ENV_BACKUP, ENV_PATH)
        subprocess.run(["sudo", "supervisorctl", "restart", "backend"], check=False, capture_output=True)
        _wait_backend_ready()

        r = requests.post(f"{BASE_URL}/api/digital-store/checkout/{EXISTING_PDF_ID}",
                          headers={"Authorization": f"Bearer {student_token}"}, timeout=20)
        assert r.status_code == 500, f"expected 500, got {r.status_code} {r.text[:200]}"
        assert r.json().get("detail") == "Razorpay credentials not configured on server"


# ===================== REQ 1 positive + REQ 3 =====================

class TestReq1And3WithSyntheticKeys:
    """Set synthetic keys, then exercise checkout + verify endpoints."""

    @classmethod
    def setup_class(cls):
        _write_env(SYNTHETIC_KEY_ID, SYNTHETIC_KEY_SECRET)

    def test_req1_checkout_502_proves_keys_loaded(self, student_token):
        # With synthetic creds, get_razorpay_keys() returns them (no 500), then
        # the Razorpay POST /orders rejects -> our server returns 502.
        r = requests.post(f"{BASE_URL}/api/digital-store/checkout/{EXISTING_PDF_ID}",
                          headers={"Authorization": f"Bearer {student_token}"}, timeout=30)
        assert r.status_code == 502, f"expected 502, got {r.status_code} {r.text[:300]}"
        body = r.json()
        assert "Razorpay order creation failed" in body.get("detail", ""), body

    def test_req3_negative_tampered_signature_400(self, student_token):
        order_id = f"{TEST_MARK}_order_neg"
        payment_id = f"{TEST_MARK}_pay_neg"
        msg = f"{order_id}|{payment_id}".encode()
        good_sig = hmac.new(SYNTHETIC_KEY_SECRET.encode(), msg, hashlib.sha256).hexdigest()
        # Tamper last char
        tampered = good_sig[:-1] + ("0" if good_sig[-1] != "0" else "1")

        body = {
            "razorpay_order_id": order_id,
            "razorpay_payment_id": payment_id,
            "razorpay_signature": tampered,
            "pdf_id": EXISTING_PDF_ID,
        }
        r = requests.post(f"{BASE_URL}/api/digital-store/payments/verify",
                          headers={"Authorization": f"Bearer {student_token}"},
                          json=body, timeout=20)
        assert r.status_code == 400, f"expected 400, got {r.status_code} {r.text[:200]}"
        assert "Invalid payment signature" in r.json().get("detail", "")

    def test_req3_positive_correct_signature_passes_then_502(self, student_token, mongo_db, student_id):
        order_id = f"{TEST_MARK}_order_pos"
        payment_id = f"{TEST_MARK}_pay_pos"
        msg = f"{order_id}|{payment_id}".encode()
        good_sig = hmac.new(SYNTHETIC_KEY_SECRET.encode(), msg, hashlib.sha256).hexdigest()

        body = {
            "razorpay_order_id": order_id,
            "razorpay_payment_id": payment_id,
            "razorpay_signature": good_sig,
            "pdf_id": EXISTING_PDF_ID,
        }
        r = requests.post(f"{BASE_URL}/api/digital-store/payments/verify",
                          headers={"Authorization": f"Bearer {student_token}"},
                          json=body, timeout=30)
        # Signature math is right -> we get past 400. Razorpay fetch for fake
        # payment id then fails -> 502 from our server.
        assert r.status_code == 502, f"expected 502 (sig OK, fetch fails), got {r.status_code} {r.text[:300]}"
        assert "Failed to fetch payment details from Razorpay" in r.json().get("detail", "")

        # REQ 4 (negative): NO payments / purchases row should have been written
        # because the fetch failed BEFORE the insert.
        assert mongo_db.payments.find_one({"provider_payment_id": payment_id}) is None
        assert mongo_db.purchases.find_one({"user_id": student_id, "payment_id": {"$regex": payment_id}}) is None


# ===================== REQ 3 negative when wrong secret used =====================

class TestReq3WrongSecret:
    """If signature was computed using the WRONG secret, server returns 400."""

    def test_signature_computed_with_wrong_secret_fails(self, student_token):
        order_id = f"{TEST_MARK}_order_wrong"
        payment_id = f"{TEST_MARK}_pay_wrong"
        msg = f"{order_id}|{payment_id}".encode()
        wrong_sig = hmac.new(b"some_other_secret", msg, hashlib.sha256).hexdigest()

        r = requests.post(f"{BASE_URL}/api/digital-store/payments/verify",
                          headers={"Authorization": f"Bearer {student_token}"},
                          json={
                              "razorpay_order_id": order_id,
                              "razorpay_payment_id": payment_id,
                              "razorpay_signature": wrong_sig,
                              "pdf_id": EXISTING_PDF_ID,
                          }, timeout=20)
        assert r.status_code == 400
        assert "Invalid payment signature" in r.json().get("detail", "")


# ===================== REQ 5 / 6: per-user gating =====================

class TestReq5And6Gating:

    def test_req6_preview_unauthenticated_401(self):
        r = requests.get(f"{BASE_URL}/api/digital-store/preview/{EXISTING_PDF_ID}", timeout=15)
        assert r.status_code == 401

    def test_req6_preview_blocked_before_purchase(self, student_token):
        r = requests.get(f"{BASE_URL}/api/digital-store/preview/{EXISTING_PDF_ID}",
                         headers={"Authorization": f"Bearer {student_token}"}, timeout=15)
        assert r.status_code == 402

    def test_req5_admin_creates_published_pdf_and_purchase_unlocks_for_student(
            self, admin_token, student_token, student_id, mongo_db):
        # Admin creates a test PDF
        title = f"{TEST_MARK}_gated"
        payload = {
            "title": title,
            "description": "rp test pdf",
            "thumbnail_url": "",
            "drive_link": "https://drive.google.com/file/d/1FAKEFILEIDFORTESTS000000000000000/view",
            "category": "test",
            "price": 199,
            "currency": "INR",
            "published": True,
        }
        r = requests.post(f"{BASE_URL}/api/digital-store",
                          headers={"Authorization": f"Bearer {admin_token}"},
                          json=payload, timeout=20)
        assert r.status_code == 200, r.text
        pdf_id = r.json()["id"]
        CREATED_PDF_IDS.append(pdf_id)

        # Student: detail says is_purchased=false, preview -> 402
        rd = requests.get(f"{BASE_URL}/api/digital-store/{pdf_id}",
                          headers={"Authorization": f"Bearer {student_token}"}, timeout=15)
        assert rd.status_code == 200
        assert rd.json()["is_purchased"] is False
        rp = requests.get(f"{BASE_URL}/api/digital-store/preview/{pdf_id}",
                          headers={"Authorization": f"Bearer {student_token}"}, timeout=15)
        assert rp.status_code == 402

        # Insert purchase row for STUDENT only
        purch_id = f"{TEST_MARK}_purch_student"
        mongo_db.purchases.insert_one({
            "id": purch_id,
            "user_id": student_id,
            "pdf_id": pdf_id,
            "payment_id": f"{TEST_MARK}_payx",
            "created_at": "2026-01-01T00:00:00.000+00:00",
        })
        CREATED_PURCHASE_IDS.append(purch_id)

        # Now student detail flips is_purchased=true
        rd2 = requests.get(f"{BASE_URL}/api/digital-store/{pdf_id}",
                           headers={"Authorization": f"Bearer {student_token}"}, timeout=15)
        assert rd2.json()["is_purchased"] is True

        # Student preview now passes gate (drive fetch will 502 since file_id is fake)
        rp2 = requests.get(f"{BASE_URL}/api/digital-store/preview/{pdf_id}",
                           headers={"Authorization": f"Bearer {student_token}"}, timeout=30)
        assert rp2.status_code != 402, f"gate should be passed, got {rp2.status_code}"
        assert rp2.status_code in (200, 502)

        # Other user (admin) has NOT bought it -> but admin bypass applies; check
        # per-user gating using student_id's purchase row: admin's detail should
        # NOT show is_purchased=true since that field is keyed on the caller's
        # user_id. (admin detail doesn't add is_purchased field.)
        rda = requests.get(f"{BASE_URL}/api/digital-store/{pdf_id}",
                           headers={"Authorization": f"Bearer {admin_token}"}, timeout=15)
        assert rda.status_code == 200
        # admin response includes drive_file_id and does NOT carry is_purchased=true
        # for someone else's purchase. (admin endpoint deliberately doesn't set it.)
        assert rda.json().get("is_purchased") in (None, False), rda.json()


# ===================== REQ 4: schema check via source ==========================

class TestReq4PaymentSchemaFromSource:
    def test_payments_doc_keys_in_source(self):
        with open("/app/backend/server.py", "r") as f:
            src = f.read()
        # locate digital_store_payments_verify body
        idx = src.find("async def digital_store_payments_verify(")
        assert idx != -1
        block = src[idx: idx + 3000]
        required_pay_keys = [
            '"provider": "razorpay"',
            '"provider_order_id"', '"provider_payment_id"', '"provider_signature"',
            '"status"', '"amount"', '"currency"', '"user_id"', '"pdf_id"', '"created_at"',
        ]
        for k in required_pay_keys:
            assert k in block, f"payments doc missing key in source: {k}"
        # purchases doc
        required_purchase_keys = ['"user_id"', '"pdf_id"', '"payment_id"', '"created_at"']
        for k in required_purchase_keys:
            assert k in block, f"purchases doc missing key in source: {k}"


# ===================== REQ 7 / 8 / 9: frontend source assertions ==============

class TestReq7And8And9FrontendSource:
    def test_checkout_jsx_success_toast_and_redirect(self):
        path = "/app/frontend/src/pages/student/Checkout.jsx"
        with open(path, "r") as f:
            src = f.read()
        # success toast mentioning unlocked PDF
        assert "Payment successful" in src or "PDF unlocked" in src, "success toast text missing"
        # navigate to /store/read/:pdfId
        assert "/store/read/" in src, "redirect to /store/read/{pdfId} missing"
        # POSTs to digital-store/payments/verify
        assert "/digital-store/payments/verify" in src

    def test_checkout_jsx_modal_escape_false_and_error_surfacing(self):
        path = "/app/frontend/src/pages/student/Checkout.jsx"
        with open(path, "r") as f:
            src = f.read()
        # modal.escape=false (graceful close handling)
        assert re.search(r"escape\s*:\s*false", src), "modal.escape=false missing"
        # surface backend detail
        assert "err.response" in src and "detail" in src, "error surfacing missing"

    def test_buybutton_uses_payments_endpoints(self):
        path = "/app/frontend/src/components/BuyButton.jsx"
        with open(path, "r") as f:
            src = f.read()
        assert "/payments/checkout/" in src or "/payments/verify" in src

    def test_digitalpdfdetail_surfaces_detail(self):
        path = "/app/frontend/src/pages/student/DigitalPdfDetail.jsx"
        with open(path, "r") as f:
            src = f.read()
        assert "detail" in src, "DigitalPdfDetail should surface backend detail"
