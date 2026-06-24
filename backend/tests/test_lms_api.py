"""LMS API tests - covers auth, dashboards, CRUD, tests/MCQ, live-classes, enrollments, cascade delete."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@lms.com", "password": "admin123"}
STUDENT = {"email": "student@lms.com", "password": "student123"}


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    return data["token"], data["user"]


@pytest.fixture(scope="session")
def admin_token():
    t, _ = _login(ADMIN)
    return t


@pytest.fixture(scope="session")
def student_token():
    t, _ = _login(STUDENT)
    return t


def admin_h(t): return {"Authorization": f"Bearer {t}"}


# -------- Auth --------
class TestAuth:
    def test_admin_login(self):
        token, user = _login(ADMIN)
        assert user["email"] == "admin@lms.com"
        assert user["role"] == "admin"
        assert isinstance(token, str) and len(token) > 10

    def test_student_login(self):
        token, user = _login(STUDENT)
        assert user["email"] == "student@lms.com"
        assert user["role"] == "student"

    def test_invalid_login(self):
        r = requests.post(f"{API}/auth/login", json={"email": "admin@lms.com", "password": "wrong"})
        assert r.status_code == 401

    def test_me_with_bearer(self, admin_token):
        r = requests.get(f"{API}/auth/me", headers=admin_h(admin_token))
        assert r.status_code == 200
        assert r.json()["email"] == "admin@lms.com"

    def test_me_unauth(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401


# -------- Dashboards --------
class TestDashboards:
    def test_student_dashboard(self, student_token):
        r = requests.get(f"{API}/dashboard/student", headers=admin_h(student_token))
        assert r.status_code == 200
        d = r.json()
        for k in ("batches", "live_classes", "latest_notes", "latest_tests"):
            assert k in d
        assert len(d["batches"]) == 3, f"Expected 3 batches, got {len(d['batches'])}"
        # tests should NOT leak correct_index for students
        for t in d["latest_tests"]:
            for q in t.get("questions", []):
                assert "correct_index" not in q

    def test_admin_dashboard_counts(self, admin_token):
        r = requests.get(f"{API}/dashboard/admin", headers=admin_h(admin_token))
        assert r.status_code == 200
        c = r.json()["counts"]
        assert c["batches"] == 3
        assert c["subjects"] == 8
        assert c["chapters"] == 32
        assert c["videos"] == 128
        assert c["notes"] == 64
        assert c["tests"] == 32
        assert c["live_classes"] == 3
        assert c["students"] >= 1

    def test_admin_dashboard_forbidden_for_student(self, student_token):
        r = requests.get(f"{API}/dashboard/admin", headers=admin_h(student_token))
        assert r.status_code == 403


# -------- CRUD admin-only --------
class TestCRUD:
    def test_batch_crud_and_cascade(self, admin_token, student_token):
        # student forbidden
        r = requests.post(f"{API}/batches", json={"name": "TEST_B"}, headers=admin_h(student_token))
        assert r.status_code == 403
        # admin create
        r = requests.post(f"{API}/batches", json={"name": "TEST_Batch_Cascade"}, headers=admin_h(admin_token))
        assert r.status_code == 200
        batch = r.json()
        assert batch["price"] == 0
        assert batch["currency"] == "INR"
        bid = batch["id"]
        # subject
        r = requests.post(f"{API}/subjects", json={"batch_id": bid, "name": "TEST_Sub"}, headers=admin_h(admin_token))
        assert r.status_code == 200
        sid = r.json()["id"]
        # chapter
        r = requests.post(f"{API}/chapters", json={"subject_id": sid, "name": "TEST_Ch"}, headers=admin_h(admin_token))
        assert r.status_code == 200
        cid = r.json()["id"]
        # video
        r = requests.post(f"{API}/videos", json={"chapter_id": cid, "title": "TEST_V", "url": "https://yt"},
                         headers=admin_h(admin_token))
        assert r.status_code == 200
        vid = r.json()["id"]
        # note
        r = requests.post(f"{API}/notes", json={"chapter_id": cid, "title": "TEST_N", "url": "https://pdf"},
                         headers=admin_h(admin_token))
        assert r.status_code == 200
        # GET to verify persistence
        r = requests.get(f"{API}/videos/{vid}", headers=admin_h(admin_token))
        assert r.status_code == 200
        assert r.json()["title"] == "TEST_V"
        # cascade delete batch
        r = requests.delete(f"{API}/batches/{bid}", headers=admin_h(admin_token))
        assert r.status_code == 200
        # verify subject gone
        r = requests.get(f"{API}/batches/{bid}", headers=admin_h(admin_token))
        assert r.status_code == 404
        subs = requests.get(f"{API}/subjects?batch_id={bid}", headers=admin_h(admin_token)).json()
        assert subs == []
        chs = requests.get(f"{API}/chapters?subject_id={sid}", headers=admin_h(admin_token)).json()
        assert chs == []
        v = requests.get(f"{API}/videos/{vid}", headers=admin_h(admin_token))
        assert v.status_code == 404

    def test_student_cannot_create_subject(self, student_token):
        r = requests.post(f"{API}/subjects", json={"batch_id": "x", "name": "x"}, headers=admin_h(student_token))
        assert r.status_code == 403


# -------- Tests/MCQ --------
class TestMCQ:
    def test_list_tests_student_hides_answers(self, student_token):
        r = requests.get(f"{API}/tests", headers=admin_h(student_token))
        assert r.status_code == 200
        tests = r.json()
        assert len(tests) > 0
        for t in tests[:3]:
            for q in t.get("questions", []):
                assert "correct_index" not in q
                assert "explanation" not in q

    def test_list_tests_admin_shows_answers(self, admin_token):
        r = requests.get(f"{API}/tests", headers=admin_h(admin_token))
        assert r.status_code == 200
        tests = r.json()
        assert any("correct_index" in q for t in tests for q in t.get("questions", []))

    def test_get_test_role_based(self, admin_token, student_token):
        tests = requests.get(f"{API}/tests", headers=admin_h(admin_token)).json()
        tid = tests[0]["id"]
        r_admin = requests.get(f"{API}/tests/{tid}", headers=admin_h(admin_token)).json()
        r_stu = requests.get(f"{API}/tests/{tid}", headers=admin_h(student_token)).json()
        assert "correct_index" in r_admin["questions"][0]
        assert "correct_index" not in r_stu["questions"][0]

    def test_submit_test_scoring(self, admin_token, student_token):
        tests = requests.get(f"{API}/tests", headers=admin_h(admin_token)).json()
        t = tests[0]
        tid = t["id"]
        # answer all correctly
        answers = [{"question_index": i, "selected_index": q["correct_index"]} for i, q in enumerate(t["questions"])]
        r = requests.post(f"{API}/tests/submit",
                          json={"test_id": tid, "answers": answers, "time_taken_seconds": 60},
                          headers=admin_h(student_token))
        assert r.status_code == 200
        d = r.json()
        assert d["score"] == d["total"]
        assert d["score_pct"] == 100.0
        assert len(d["breakdown"]) == d["total"]
        assert "correct_index" in d["breakdown"][0]
        assert "explanation" in d["breakdown"][0]

    def test_submit_test_partial(self, admin_token, student_token):
        tests = requests.get(f"{API}/tests", headers=admin_h(admin_token)).json()
        t = tests[0]
        # answer all wrong (pick 0 except where correct is 0 -> pick 3)
        answers = []
        for i, q in enumerate(t["questions"]):
            wrong = 0 if q["correct_index"] != 0 else 3
            answers.append({"question_index": i, "selected_index": wrong})
        r = requests.post(f"{API}/tests/submit",
                          json={"test_id": t["id"], "answers": answers}, headers=admin_h(student_token))
        assert r.status_code == 200
        assert r.json()["score"] == 0


# -------- Live classes --------
class TestLiveClasses:
    def test_live_classes_status(self, student_token):
        r = requests.get(f"{API}/live-classes", headers=admin_h(student_token))
        assert r.status_code == 200
        items = r.json()
        assert len(items) >= 1
        for it in items:
            assert it["status"] in ("upcoming", "live", "ended")


# -------- Enrollments --------
class TestEnrollments:
    def test_self_enroll(self, admin_token, student_token):
        # create a new batch as admin
        r = requests.post(f"{API}/batches", json={"name": "TEST_Enroll_Batch"}, headers=admin_h(admin_token))
        bid = r.json()["id"]
        try:
            r = requests.post(f"{API}/enrollments/self/{bid}", headers=admin_h(student_token))
            assert r.status_code == 200
            data = r.json()
            assert data.get("student_id") or data.get("ok")
            # idempotent
            r2 = requests.post(f"{API}/enrollments/self/{bid}", headers=admin_h(student_token))
            assert r2.status_code == 200
            assert r2.json().get("already") is True
        finally:
            requests.delete(f"{API}/batches/{bid}", headers=admin_h(admin_token))


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
