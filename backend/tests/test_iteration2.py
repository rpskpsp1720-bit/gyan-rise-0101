"""Iteration 2 tests: GYAN RISE RANA — student-only register, image upload,
recently viewed, completion, live chat WebSocket, role guard."""
import os
import json
import base64
import asyncio
import pytest
import requests
import websockets

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"
WS_BASE = BASE_URL.replace("https://", "wss://").replace("http://", "ws://")

ADMIN = {"email": "admin@lms.com", "password": "admin123"}
STUDENT = {"email": "student@lms.com", "password": "student123"}


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["token"], r.json()["user"]


def H(t):
    return {"Authorization": f"Bearer {t}"}


@pytest.fixture(scope="module")
def admin_token():
    t, _ = _login(ADMIN)
    return t


@pytest.fixture(scope="module")
def student_token():
    t, _ = _login(STUDENT)
    return t


# 1x1 PNG
TINY_PNG_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII="
)


class TestRegisterRoleForced:
    def test_register_ignores_admin_role_in_body(self):
        import uuid
        email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        # Try to inject role admin (model RegisterIn does not have role, but include extra anyway)
        r = requests.post(f"{API}/auth/register",
                          json={"email": email, "password": "secret123", "name": "Tester", "role": "admin"})
        assert r.status_code == 200, r.text
        user = r.json()["user"]
        assert user["role"] == "student", f"Registered as {user['role']} — must be 'student'"

    def test_existing_demo_logins(self):
        _login(ADMIN)
        _login(STUDENT)


class TestImageUpload:
    def test_admin_upload_and_fetch(self, admin_token):
        png_bytes = base64.b64decode(TINY_PNG_B64)
        files = {"file": ("tiny.png", png_bytes, "image/png")}
        r = requests.post(f"{API}/uploads/image", files=files, headers=H(admin_token))
        assert r.status_code == 200, r.text
        data = r.json()
        assert "id" in data and "url" in data
        assert data["url"] == f"/api/images/{data['id']}"
        # fetch binary
        r2 = requests.get(f"{BASE_URL}{data['url']}")
        assert r2.status_code == 200
        assert r2.headers.get("content-type", "").startswith("image/png")
        assert r2.content == png_bytes

    def test_student_upload_forbidden(self, student_token):
        png_bytes = base64.b64decode(TINY_PNG_B64)
        files = {"file": ("tiny.png", png_bytes, "image/png")}
        r = requests.post(f"{API}/uploads/image", files=files, headers=H(student_token))
        assert r.status_code == 403, r.text

    def test_anonymous_upload_unauth(self):
        png_bytes = base64.b64decode(TINY_PNG_B64)
        files = {"file": ("tiny.png", png_bytes, "image/png")}
        r = requests.post(f"{API}/uploads/image", files=files)
        assert r.status_code == 401


class TestRecentlyViewedAndCompletion:
    def test_recently_viewed_and_completion_pct(self, student_token, admin_token):
        # pick a batch with content
        batches = requests.get(f"{API}/batches", headers=H(student_token)).json()
        assert len(batches) >= 1
        bid = batches[0]["id"]
        # find a video in that batch
        subs = requests.get(f"{API}/subjects?batch_id={bid}", headers=H(student_token)).json()
        assert subs
        chs = requests.get(f"{API}/chapters?subject_id={subs[0]['id']}", headers=H(student_token)).json()
        assert chs
        vids = requests.get(f"{API}/videos?chapter_id={chs[0]['id']}", headers=H(student_token)).json()
        assert vids
        v = vids[0]
        # post progress: full duration to mark completed
        r = requests.post(f"{API}/progress",
                          json={"video_id": v["id"], "position_seconds": v["duration_seconds"],
                                "duration_seconds": v["duration_seconds"]},
                          headers=H(student_token))
        assert r.status_code == 200
        # recently-viewed
        r = requests.get(f"{API}/progress/recently-viewed", headers=H(student_token))
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list) and len(items) >= 1
        top = items[0]
        for k in ("video", "chapter", "subject"):
            assert k in top, f"missing {k}"
        assert top["video"]["id"] == v["id"]
        # completion
        r = requests.get(f"{API}/progress/completion/{bid}", headers=H(student_token))
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("pct", "completed", "total", "per_subject"):
            assert k in d
        assert d["total"] > 0
        assert d["completed"] >= 1
        assert d["pct"] > 0
        assert isinstance(d["per_subject"], list) and len(d["per_subject"]) == len(subs)
        for ps in d["per_subject"]:
            for k in ("id", "name", "completed", "total", "pct"):
                assert k in ps


class TestChatWebSocket:
    @pytest.mark.asyncio
    async def test_chat_message_broadcast_and_history(self, student_token, admin_token):
        # find a live class
        lcs = requests.get(f"{API}/live-classes", headers=H(student_token)).json()
        assert lcs, "Need at least one live class"
        lc_id = lcs[0]["id"]
        url_s = f"{WS_BASE}/api/ws/chat/{lc_id}?token={student_token}"
        url_a = f"{WS_BASE}/api/ws/chat/{lc_id}?token={admin_token}"

        async with websockets.connect(url_s) as ws_s, websockets.connect(url_a) as ws_a:
            # drain presence messages
            for ws in (ws_s, ws_a):
                try:
                    while True:
                        msg = await asyncio.wait_for(ws.recv(), timeout=0.5)
                        # presence
                        if json.loads(msg).get("type") != "presence":
                            break
                except asyncio.TimeoutError:
                    pass

            # student sends a message
            test_text = "hello-from-test"
            await ws_s.send(json.dumps({"type": "message", "message": test_text}))

            # collect broadcasted message on admin socket
            received_msg = None
            for _ in range(8):
                raw = await asyncio.wait_for(ws_a.recv(), timeout=3)
                payload = json.loads(raw)
                if payload.get("type") == "message" and payload["message"].get("message") == test_text:
                    received_msg = payload["message"]
                    break
            assert received_msg, "did not receive broadcasted message on admin socket"
            assert received_msg["user_role"] == "student"
            assert received_msg["user_name"]
            msg_id = received_msg["id"]

            # student tries pin → should be IGNORED (no broadcast). Then admin pins → broadcast.
            await ws_s.send(json.dumps({"type": "pin", "message_id": msg_id}))
            # Brief wait, ensure no pin from student
            got_student_pin = False
            try:
                while True:
                    raw = await asyncio.wait_for(ws_a.recv(), timeout=0.5)
                    p = json.loads(raw)
                    if p.get("type") == "pin":
                        got_student_pin = True
                        break
            except asyncio.TimeoutError:
                pass
            assert not got_student_pin, "Student pin should be ignored"

            await ws_a.send(json.dumps({"type": "pin", "message_id": msg_id}))
            pin_event = None
            for _ in range(8):
                raw = await asyncio.wait_for(ws_s.recv(), timeout=3)
                p = json.loads(raw)
                if p.get("type") == "pin":
                    pin_event = p
                    break
            assert pin_event and pin_event["pinned"] is True

        # history endpoint returns persisted message
        r = requests.get(f"{API}/chat/{lc_id}/history", headers=H(student_token))
        assert r.status_code == 200
        body = r.json()
        assert "messages" in body and "online" in body
        assert any(m["message"] == "hello-from-test" for m in body["messages"])

    @pytest.mark.asyncio
    async def test_ws_invalid_token_rejected(self):
        lcs = requests.get(f"{API}/live-classes", headers=H(_login(STUDENT)[0])).json()
        lc_id = lcs[0]["id"]
        url = f"{WS_BASE}/api/ws/chat/{lc_id}?token=garbage"
        with pytest.raises(Exception):
            async with websockets.connect(url) as ws:
                await asyncio.wait_for(ws.recv(), timeout=3)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
