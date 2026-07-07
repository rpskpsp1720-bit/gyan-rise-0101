from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import uuid
import logging
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, WebSocket, WebSocketDisconnect, UploadFile, File
from starlette.middleware.cors import CORSMiddleware
from starlette.responses import Response as StarletteResponse
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr
import base64
import asyncio
from collections import defaultdict
import hmac
import hashlib
import httpx

mongo_url = os.environ["MONGO_URL"]
# Production-safe Motor client config:
#   * serverSelectionTimeoutMS — fail fast if Atlas is unreachable (10s instead of 30s default)
#   * connectTimeoutMS / socketTimeoutMS — bound per-connection latency
#   * retryWrites — auto-retry one-shot write failures (replica set primary swap, etc.)
#   * maxPoolSize — keep connections bounded on Render's small dynos
# Motor/PyMongo handle auto-reconnect to a new primary internally; no manual retry needed.
client = AsyncIOMotorClient(
    mongo_url,
    serverSelectionTimeoutMS=10000,
    connectTimeoutMS=10000,
    socketTimeoutMS=20000,
    retryWrites=True,
    maxPoolSize=50,
)
db = client[os.environ["DB_NAME"]]

app = FastAPI(title="GYAN RISE RANA E-LEARNING API")
api = APIRouter(prefix="/api")

JWT_ALGORITHM = "HS256"
DEFAULT_FRONTEND_URL = "https://gyan-rise-0101.vercel.app"


def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def get_frontend_url() -> str:
    return os.environ.get("FRONTEND_URL", DEFAULT_FRONTEND_URL).rstrip("/")


def get_cors_origins() -> List[str]:
    origins = os.environ.get("CORS_ORIGINS", DEFAULT_FRONTEND_URL)
    return [origin.strip() for origin in origins.split(",") if origin.strip()]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "access",
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def new_id() -> str:
    return str(uuid.uuid4())


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# Firebase Admin integration (initialized after logger is configured)
USE_FIREBASE_ADMIN = False
fb_messaging = None


# ---------- Models ----------
class UserPublic(BaseModel):
    id: str
    email: str
    name: str
    role: str
    avatar_url: Optional[str] = None
    created_at: Optional[str] = None


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class BatchIn(BaseModel):
    name: str
    description: str = ""
    cover_url: Optional[str] = None
    target_exam: Optional[str] = None
    year: Optional[int] = None
    price: float = Field(0, ge=0)  # 0 means free
    currency: str = Field("INR", min_length=3, max_length=3)


class SubjectIn(BaseModel):
    batch_id: str
    name: str
    icon: Optional[str] = None
    color: Optional[str] = None
    cover_url: Optional[str] = None


class ChapterIn(BaseModel):
    subject_id: str
    name: str
    order: int = 0


class VideoIn(BaseModel):
    chapter_id: str
    title: str
    description: str = ""
    url: str
    duration_seconds: int = 0
    order: int = 0


class NoteIn(BaseModel):
    chapter_id: str
    title: str
    url: str
    description: str = ""


class FcmTokenIn(BaseModel):
    token: str
    platform: Optional[Literal["web", "pwa", "android", "browser"]] = "web"
    user_agent: Optional[str] = None


class NotificationSendIn(BaseModel):
    mode: str
    entity_id: Optional[str] = None
    title: Optional[str] = None
    body: Optional[str] = None
    url: Optional[str] = None
    data: Optional[dict] = None


class QuestionIn(BaseModel):
    question: str
    options: List[str]
    correct_index: int
    explanation: str = ""


class TestIn(BaseModel):
    chapter_id: str
    title: str
    description: str = ""
    duration_minutes: int = 10
    questions: List[QuestionIn]


class LiveClassIn(BaseModel):
    title: str
    batch_id: str
    subject_id: Optional[str] = None
    chapter_id: Optional[str] = None
    youtube_url: str
    start_time: str
    description: str = ""
    recording_url: Optional[str] = None


class EnrollIn(BaseModel):
    student_id: str
    batch_id: str


class WatchProgressIn(BaseModel):
    video_id: str
    position_seconds: int
    duration_seconds: int


class TestSubmitAnswer(BaseModel):
    question_index: int
    selected_index: int


class TestSubmitIn(BaseModel):
    test_id: str
    answers: List[TestSubmitAnswer]
    time_taken_seconds: int = 0


# ---------- Auth dep ----------
async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["sub"]})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user.pop("password_hash", None)
        user.pop("_id", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


def set_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=60 * 60 * 24 * 7,
        path="/",
    )


def get_fcm_server_key() -> str:
    key = os.environ.get("FCM_SERVER_KEY")
    if not key:
        raise HTTPException(status_code=500, detail="FCM server key not configured")
    return key


def resolve_notification_url(url: Optional[str]) -> str:
    if not url:
        return "/"
    if url.startswith("http://") or url.startswith("https://"):
        return url
    frontend = get_frontend_url()
    return f"{frontend}{url}" if frontend else url


async def get_all_fcm_tokens(user_ids: Optional[List[str]] = None) -> List[str]:
    query = {"user_id": {"$in": user_ids}} if user_ids else {}
    tokens = await db.fcm_tokens.find(query, {"token": 1}).to_list(10000)
    return [t["token"] for t in tokens if t.get("token")]


async def log_notification_event(
    user_id: str,
    mode: str,
    title: str,
    body: str,
    url: Optional[str],
    target_count: int,
    result: dict,
) -> dict:
    doc = {
        "id": new_id(),
        "type": mode,
        "title": title,
        "body": body,
        "url": url,
        "data": result.get("data") if result else None,
        "target_count": target_count,
        "success_count": result.get("success", 0) if result else 0,
        "failure_count": result.get("failure", 0) if result else 0,
        "status": "sent" if result and result.get("failure", 0) == 0 else "partial" if result and result.get("success", 0) > 0 else "failed",
        "sent_by": user_id,
        "created_at": now_iso(),
    }
    await db.notifications.insert_one(doc)
    doc.pop("_id", None)
    return doc


async def send_fcm_message(tokens: List[str], title: str, body: str, url: Optional[str] = None, data: Optional[dict] = None) -> dict:
    if not tokens:
        return {"success": 0, "failure": 0, "skipped": 0}

    headers = {
        "Authorization": f"key={get_fcm_server_key()}",
        "Content-Type": "application/json",
    }
    resolved_url = resolve_notification_url(url)
    payload = {
        "notification": {
            "title": title,
            "body": body,
            "click_action": resolved_url,
        },
        "data": {"url": resolved_url, **(data or {})},
        "webpush": {
            "fcm_options": {"link": resolved_url},
        },
    }

    success_count = 0
    failure_count = 0
    results = []
    for i in range(0, len(tokens), 500):
        chunk = tokens[i : i + 500]
        body_payload = {**payload, "registration_ids": chunk}
        async with httpx.AsyncClient(timeout=30.0) as client:
            r = await client.post("https://fcm.googleapis.com/fcm/send", json=body_payload, headers=headers)
        if r.status_code != 200:
            results.append({"status": r.status_code, "body": r.text})
            failure_count += len(chunk)
            continue
        data_resp = r.json()
        success_count += data_resp.get("success", 0)
        failure_count += data_resp.get("failure", 0)
        results.append(data_resp)

    return {"success": success_count, "failure": failure_count, "results": results}


async def save_fcm_token(user_id: str, token: str, platform: str = "web", user_agent: Optional[str] = None):
    if not token:
        return
    now = now_iso()
    await db.fcm_tokens.update_one(
        {"user_id": user_id, "token": token},
        {
            "$set": {
                "user_id": user_id,
                "token": token,
                "platform": platform,
                "user_agent": user_agent,
                "updated_at": now,
            },
            "$setOnInsert": {"created_at": now},
        },
        upsert=True,
    )


# ---------- Auth Endpoints ----------
@api.post("/auth/register")
async def register(body: RegisterIn, response: Response):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    user = {
        "id": new_id(),
        "email": email,
        "name": body.name,
        "password_hash": hash_password(body.password),
        "role": "student",
        "avatar_url": None,
        "created_at": now_iso(),
    }
    await db.users.insert_one(user)
    token = create_access_token(user["id"], email, user["role"])
    set_auth_cookie(response, token)
    user.pop("password_hash", None)
    user.pop("_id", None)
    return {"user": user, "token": token}


@api.post("/auth/login")
async def login(body: LoginIn, response: Response):
    email = body.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(user["id"], email, user["role"])
    set_auth_cookie(response, token)
    user.pop("password_hash", None)
    user.pop("_id", None)
    return {"user": user, "token": token}


@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


@api.post("/auth/fcm-token")
async def register_fcm_token(body: FcmTokenIn, user: dict = Depends(get_current_user)):
    await save_fcm_token(user["id"], body.token, body.platform or "web", body.user_agent)
    return {"ok": True}


class ForgotPasswordIn(BaseModel):
    email: EmailStr


@api.post("/auth/forgot-password")
async def forgot_password(body: ForgotPasswordIn):
    """Generate a password-reset token for the given email.

    Always returns a generic success response (anti-enumeration). When an email
    provider is configured, the reset link will be sent to the user; until then
    the token is stored in the DB and can be retrieved by an admin to share with
    the student out of band.
    """
    email = body.email.lower()
    user = await db.users.find_one({"email": email})
    if user:
        token = new_id()
        await db.password_resets.insert_one(
            {
                "id": new_id(),
                "user_id": user["id"],
                "email": email,
                "token": token,
                "used": False,
                "created_at": now_iso(),
                "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat(),
            }
        )
        frontend = os.environ.get("FRONTEND_URL", "").rstrip("/")
        reset_link = f"{frontend}/reset-password?token={token}" if frontend else f"/reset-password?token={token}"
        # TODO: wire an email provider (SendGrid / Resend / SES) to deliver `reset_link` to `email`.
        logger.info(f"[forgot-password] reset link for {email}: {reset_link}")
    # Always 200 — do not reveal whether the email exists.
    return {"ok": True, "message": "If an account exists for that email, a reset link has been sent."}


class ResetPasswordIn(BaseModel):
    token: str
    new_password: str = Field(min_length=6)


@api.post("/auth/reset-password")
async def reset_password(body: ResetPasswordIn):
    """Consume a password-reset token and set a new password."""
    record = await db.password_resets.find_one({"token": body.token, "used": False})
    if not record:
        raise HTTPException(status_code=400, detail="Invalid or already-used reset token")
    try:
        expires_at = datetime.fromisoformat(record["expires_at"])
    except Exception:
        expires_at = None
    if expires_at and datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=400, detail="Reset token has expired")
    await db.users.update_one(
        {"id": record["user_id"]},
        {"$set": {"password_hash": hash_password(body.new_password)}},
    )
    await db.password_resets.update_one({"id": record["id"]}, {"$set": {"used": True, "used_at": now_iso()}})
    return {"ok": True, "message": "Password updated. Please sign in with your new password."}


class ChangePasswordIn(BaseModel):
    current_password: str = Field(min_length=1)
    new_password: str = Field(min_length=6)


@api.post("/auth/change-password")
async def change_password(body: ChangePasswordIn, user: dict = Depends(get_current_user)):
    """Authenticated password change.

    Requires the caller's current password (verified against the stored
    bcrypt hash) before setting a new password. Uses the same hash_password
    helper the rest of the project uses so existing login flow keeps working.
    """
    # Re-fetch the latest password_hash from DB (the dependency-resolved user
    # is sanitised and does NOT carry the hash).
    db_user = await db.users.find_one({"id": user["id"]})
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    if not verify_password(body.current_password, db_user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    if body.new_password == body.current_password:
        raise HTTPException(status_code=400, detail="New password must be different from current password")
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"password_hash": hash_password(body.new_password)}},
    )
    return {"ok": True, "message": "Password changed successfully"}


@api.get("/auth/me", response_model=UserPublic)
async def me(user: dict = Depends(get_current_user)):
    return user


@api.get("/notifications/history")
async def list_notifications(user: dict = Depends(require_admin)):
    return await db.notifications.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)


@api.post("/notifications/send")
async def send_notification(body: NotificationSendIn, user: dict = Depends(require_admin)):
    title = body.title or "Notification from GYAN RISE"
    body_msg = body.body or "A new update is available."
    url = body.url or "/"
    if body.mode not in {"live_class", "new_batch", "content_upload", "custom"}:
        raise HTTPException(status_code=400, detail="Invalid notification mode")

    if body.mode == "live_class":
        if body.entity_id:
            live_class = await db.live_classes.find_one({"id": body.entity_id}, {"_id": 0})
            if not live_class:
                raise HTTPException(status_code=404, detail="Live class not found")
            title = title or f"Live class started: {live_class['title']}"
            body_msg = body_msg or f"{live_class['title']} is now live. Join the class."
        else:
            title = title or "Live class update"
            body_msg = body_msg or "A live class has started. Check it out now."
        url = url or "/live-classes"
    elif body.mode == "new_batch":
        if body.entity_id:
            batch = await db.batches.find_one({"id": body.entity_id}, {"_id": 0})
            if not batch:
                raise HTTPException(status_code=404, detail="Batch not found")
            title = title or f"New batch published: {batch['name']}"
            body_msg = body_msg or (batch.get("description") or "New batch available now.")
            url = url or f"/batches/{batch['id']}"
        else:
            title = title or "New batch published"
            body_msg = body_msg or "A new batch is now available."
            url = url or "/batches"
    elif body.mode == "content_upload":
        if body.entity_id:
            note = await db.notes.find_one({"id": body.entity_id}, {"_id": 0})
            if note:
                title = title or f"New notes uploaded: {note['title']}"
                body_msg = body_msg or "A new PDF note is available."
                url = url or f"/chapters/{note['chapter_id']}"
            else:
                video = await db.videos.find_one({"id": body.entity_id}, {"_id": 0})
                if video:
                    title = title or f"New recording available: {video['title']}"
                    body_msg = body_msg or "A new recording was uploaded."
                    url = url or f"/videos/{video['id']}"
                else:
                    raise HTTPException(status_code=404, detail="Content not found")
        else:
            title = title or "New content available"
            body_msg = body_msg or "New notes, PDFs, or recordings are now available."
            url = url or "/"
    else:
        title = title or "Custom notification"
        body_msg = body_msg or "A message from admin."
        url = url or "/"

    tokens = await get_all_fcm_tokens()
    result = await send_fcm_message(tokens, title, body_msg, url, {**(body.data or {}), "mode": body.mode, "entity_id": body.entity_id})
    await log_notification_event(user["id"], body.mode, title, body_msg, url, len(tokens), result)
    return {"ok": True, "result": result}


# ---------- Batches ----------
@api.get("/batches")
async def list_batches(user: dict = Depends(get_current_user)):
    batches = await db.batches.find({}, {"_id": 0}).to_list(1000)
    enrolled = set()
    async for e in db.enrollments.find({"student_id": user["id"]}, {"_id": 0, "batch_id": 1}):
        enrolled.add(e["batch_id"])
    for b in batches:
        b["is_enrolled"] = b["id"] in enrolled
        b.setdefault("price", 0)
        b.setdefault("currency", "INR")
    return batches


@api.post("/batches")
async def create_batch(body: BatchIn, user: dict = Depends(require_admin)):
    doc = {"id": new_id(), **body.model_dump(), "created_at": now_iso()}
    await db.batches.insert_one(doc)
    doc.pop("_id", None)
    try:
        tokens = await get_all_fcm_tokens()
        if tokens:
            await send_fcm_message(
                tokens,
                f"New batch published: {doc['name']}",
                doc.get("description") or "A new batch is now available.",
                f"/batches/{doc['id']}",
                {"mode": "new_batch", "entity_id": doc['id']},
            )
    except Exception as exc:
        logger.warning(f"Failed to send batch notification: {exc}")
    return doc


@api.put("/batches/{batch_id}")
async def update_batch(batch_id: str, body: BatchIn, user: dict = Depends(require_admin)):
    await db.batches.update_one({"id": batch_id}, {"$set": body.model_dump()})
    return await db.batches.find_one({"id": batch_id}, {"_id": 0})


@api.delete("/batches/{batch_id}")
async def delete_batch(batch_id: str, user: dict = Depends(require_admin)):
    subject_ids = [s["id"] async for s in db.subjects.find({"batch_id": batch_id})]
    chapter_ids = [c["id"] async for c in db.chapters.find({"subject_id": {"$in": subject_ids}})]
    await db.batches.delete_one({"id": batch_id})
    await db.subjects.delete_many({"batch_id": batch_id})
    await db.chapters.delete_many({"subject_id": {"$in": subject_ids}})
    await db.videos.delete_many({"chapter_id": {"$in": chapter_ids}})
    await db.notes.delete_many({"chapter_id": {"$in": chapter_ids}})
    await db.tests.delete_many({"chapter_id": {"$in": chapter_ids}})
    await db.enrollments.delete_many({"batch_id": batch_id})
    return {"ok": True}


@api.get("/batches/{batch_id}")
async def get_batch(batch_id: str, user: dict = Depends(get_current_user)):
    b = await db.batches.find_one({"id": batch_id}, {"_id": 0})
    if not b:
        raise HTTPException(status_code=404, detail="Batch not found")
    b["is_enrolled"] = bool(await db.enrollments.find_one({"student_id": user["id"], "batch_id": batch_id}))
    b.setdefault("price", 0)
    b.setdefault("currency", "INR")
    return b


# ---------- Subjects ----------
@api.get("/subjects")
async def list_subjects(batch_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {"batch_id": batch_id} if batch_id else {}
    return await db.subjects.find(q, {"_id": 0}).to_list(1000)


@api.post("/subjects")
async def create_subject(body: SubjectIn, user: dict = Depends(require_admin)):
    doc = {"id": new_id(), **body.model_dump(), "created_at": now_iso()}
    await db.subjects.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.put("/subjects/{subject_id}")
async def update_subject(subject_id: str, body: SubjectIn, user: dict = Depends(require_admin)):
    await db.subjects.update_one({"id": subject_id}, {"$set": body.model_dump()})
    return await db.subjects.find_one({"id": subject_id}, {"_id": 0})


@api.delete("/subjects/{subject_id}")
async def delete_subject(subject_id: str, user: dict = Depends(require_admin)):
    chapter_ids = [c["id"] async for c in db.chapters.find({"subject_id": subject_id})]
    await db.subjects.delete_one({"id": subject_id})
    await db.chapters.delete_many({"subject_id": subject_id})
    await db.videos.delete_many({"chapter_id": {"$in": chapter_ids}})
    await db.notes.delete_many({"chapter_id": {"$in": chapter_ids}})
    await db.tests.delete_many({"chapter_id": {"$in": chapter_ids}})
    return {"ok": True}


@api.get("/subjects/{subject_id}")
async def get_subject(subject_id: str, user: dict = Depends(get_current_user)):
    s = await db.subjects.find_one({"id": subject_id}, {"_id": 0})
    if not s:
        raise HTTPException(status_code=404, detail="Subject not found")
    return s


# ---------- Chapters ----------
@api.get("/chapters")
async def list_chapters(subject_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {"subject_id": subject_id} if subject_id else {}
    return await db.chapters.find(q, {"_id": 0}).sort("order", 1).to_list(1000)


@api.post("/chapters")
async def create_chapter(body: ChapterIn, user: dict = Depends(require_admin)):
    doc = {"id": new_id(), **body.model_dump(), "created_at": now_iso()}
    await db.chapters.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.put("/chapters/{chapter_id}")
async def update_chapter(chapter_id: str, body: ChapterIn, user: dict = Depends(require_admin)):
    await db.chapters.update_one({"id": chapter_id}, {"$set": body.model_dump()})
    return await db.chapters.find_one({"id": chapter_id}, {"_id": 0})


@api.delete("/chapters/{chapter_id}")
async def delete_chapter(chapter_id: str, user: dict = Depends(require_admin)):
    await db.chapters.delete_one({"id": chapter_id})
    await db.videos.delete_many({"chapter_id": chapter_id})
    await db.notes.delete_many({"chapter_id": chapter_id})
    await db.tests.delete_many({"chapter_id": chapter_id})
    return {"ok": True}


@api.get("/chapters/{chapter_id}")
async def get_chapter(chapter_id: str, user: dict = Depends(get_current_user)):
    c = await db.chapters.find_one({"id": chapter_id}, {"_id": 0})
    if not c:
        raise HTTPException(status_code=404, detail="Chapter not found")
    return c


# ---------- Videos ----------
@api.get("/videos")
async def list_videos(chapter_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    if chapter_id:
        ch = await db.chapters.find_one({"id": chapter_id}, {"_id": 0})
        if not ch:
            raise HTTPException(status_code=404, detail="Chapter not found")
        sub = await db.subjects.find_one({"id": ch["subject_id"]}, {"_id": 0}) if ch else None
        if sub:
            await ensure_batch_access(sub["batch_id"], user)
        q = {"chapter_id": chapter_id}
        return await db.videos.find(q, {"_id": 0}).sort("order", 1).to_list(1000)
    # No chapter_id: for admin return all, else return videos only for enrolled batches
    if user.get("role") == "admin":
        return await db.videos.find({}, {"_id": 0}).sort("order", 1).to_list(1000)
    enrolls = await db.enrollments.find({"student_id": user["id"]}, {"_id": 0}).to_list(1000)
    batch_ids = [e["batch_id"] for e in enrolls]
    subjects = await db.subjects.find({"batch_id": {"$in": batch_ids}}, {"_id": 0}).to_list(2000)
    chapter_ids = [c["id"] async for c in db.chapters.find({"subject_id": {"$in": [s["id"] for s in subjects]}})]
    return await db.videos.find({"chapter_id": {"$in": chapter_ids}}, {"_id": 0}).sort("order", 1).to_list(1000)


@api.post("/videos")
async def create_video(body: VideoIn, user: dict = Depends(require_admin)):
    doc = {"id": new_id(), **body.model_dump(), "created_at": now_iso()}
    await db.videos.insert_one(doc)
    doc.pop("_id", None)
    try:
        tokens = await get_all_fcm_tokens()
        if tokens:
            await send_fcm_message(
                tokens,
                f"New recording available: {doc['title']}",
                "A new lecture recording has been uploaded.",
                f"/videos/{doc['id']}",
                {"mode": "content_upload", "entity_id": doc['id']},
            )
    except Exception as exc:
        logger.warning(f"Failed to send video notification: {exc}")
    return doc


@api.put("/videos/{video_id}")
async def update_video(video_id: str, body: VideoIn, user: dict = Depends(require_admin)):
    await db.videos.update_one({"id": video_id}, {"$set": body.model_dump()})
    return await db.videos.find_one({"id": video_id}, {"_id": 0})


@api.delete("/videos/{video_id}")
async def delete_video(video_id: str, user: dict = Depends(require_admin)):
    await db.videos.delete_one({"id": video_id})
    return {"ok": True}


@api.get("/videos/{video_id}")
async def get_video(video_id: str, user: dict = Depends(get_current_user)):
    v = await db.videos.find_one({"id": video_id}, {"_id": 0})
    if not v:
        raise HTTPException(status_code=404, detail="Video not found")
    ch = await db.chapters.find_one({"id": v["chapter_id"]}, {"_id": 0})
    sub = await db.subjects.find_one({"id": ch["subject_id"]}, {"_id": 0}) if ch else None
    if sub:
        await ensure_batch_access(sub["batch_id"], user)
    return v


# ---------- Notes ----------
@api.get("/notes")
async def list_notes(chapter_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    if chapter_id:
        ch = await db.chapters.find_one({"id": chapter_id}, {"_id": 0})
        if not ch:
            raise HTTPException(status_code=404, detail="Chapter not found")
        sub = await db.subjects.find_one({"id": ch["subject_id"]}, {"_id": 0}) if ch else None
        if sub:
            await ensure_batch_access(sub["batch_id"], user)
        q = {"chapter_id": chapter_id}
        return await db.notes.find(q, {"_id": 0}).to_list(1000)
    if user.get("role") == "admin":
        return await db.notes.find({}, {"_id": 0}).to_list(1000)
    enrolls = await db.enrollments.find({"student_id": user["id"]}, {"_id": 0}).to_list(1000)
    batch_ids = [e["batch_id"] for e in enrolls]
    subjects = await db.subjects.find({"batch_id": {"$in": batch_ids}}, {"_id": 0}).to_list(2000)
    chapter_ids = [c["id"] async for c in db.chapters.find({"subject_id": {"$in": [s["id"] for s in subjects]}})]
    return await db.notes.find({"chapter_id": {"$in": chapter_ids}}, {"_id": 0}).to_list(1000)


@api.post("/notes")
async def create_note(body: NoteIn, user: dict = Depends(require_admin)):
    doc = {"id": new_id(), **body.model_dump(), "created_at": now_iso()}
    await db.notes.insert_one(doc)
    doc.pop("_id", None)
    try:
        tokens = await get_all_fcm_tokens()
        if tokens:
            await send_fcm_message(
                tokens,
                f"New notes uploaded: {doc['title']}",
                "A new PDF note is available for your course.",
                f"/chapters/{doc['chapter_id']}",
                {"mode": "content_upload", "entity_id": doc['id']},
            )
    except Exception as exc:
        logger.warning(f"Failed to send note notification: {exc}")
    return doc


@api.put("/notes/{note_id}")
async def update_note(note_id: str, body: NoteIn, user: dict = Depends(require_admin)):
    await db.notes.update_one({"id": note_id}, {"$set": body.model_dump()})
    return await db.notes.find_one({"id": note_id}, {"_id": 0})

    ch = await db.chapters.find_one({"id": doc["chapter_id"]}, {"_id": 0})
    sub = await db.subjects.find_one({"id": ch["subject_id"]}, {"_id": 0}) if ch else None
    if sub:
        await ensure_batch_access(sub["batch_id"], user)
    return doc
@api.delete("/notes/{note_id}")
async def delete_note(note_id: str, user: dict = Depends(require_admin)):
    await db.notes.delete_one({"id": note_id})
    return {"ok": True}


# ---------- Digital Store (PDFs) ----------
class DigitalPdfIn(BaseModel):
    title: str
    description: str = ""
    thumbnail_url: Optional[str] = None
    drive_link: str
    category: Optional[str] = None
    price: float = Field(0, ge=0)
    currency: str = Field("INR", min_length=3, max_length=3)
    published: bool = False


def _extract_drive_file_id(link: str) -> Optional[str]:
    # Accept direct file id or full google drive share link
    if not link:
        return None
    # If already an id (simple alnum and - _)
    import re

    maybe = link.strip()
    if re.fullmatch(r"[a-zA-Z0-9_-]{10,}", maybe):
        return maybe
    # common patterns
    m = re.search(r"/d/([a-zA-Z0-9_-]{10,})", link)
    if m:
        return m.group(1)
    m = re.search(r"id=([a-zA-Z0-9_-]{10,})", link)
    if m:
        return m.group(1)
    return None


@api.get("/digital-store")
async def list_digital_store(user: dict = Depends(get_current_user)):
    if user.get("role") == "admin":
        items = await db.digital_pdfs.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    else:
        items = await db.digital_pdfs.find({"published": True}, {"_id": 0}).sort("created_at", -1).to_list(1000)
        # hide drive_file_id from non-admins and stamp purchase state
        purchased_ids = set()
        if items:
            pdf_ids = [it["id"] for it in items]
            cursor = db.purchases.find({"user_id": user["id"], "pdf_id": {"$in": pdf_ids}}, {"pdf_id": 1, "_id": 0})
            async for p in cursor:
                purchased_ids.add(p.get("pdf_id"))
        for it in items:
            it.pop("drive_file_id", None)
            it["is_purchased"] = it["id"] in purchased_ids
    return items


@api.post("/digital-store")
async def create_digital_pdf(body: DigitalPdfIn, user: dict = Depends(require_admin)):
    file_id = _extract_drive_file_id(body.drive_link)
    if not file_id:
        raise HTTPException(status_code=400, detail="Invalid Google Drive link")
    doc = {
        "id": new_id(),
        "title": body.title,
        "description": body.description,
        "thumbnail_url": body.thumbnail_url,
        "drive_file_id": file_id,
        "category": body.category,
        "price": body.price,
        "currency": body.currency,
        "published": bool(body.published),
        "created_at": now_iso(),
    }
    await db.digital_pdfs.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.put("/digital-store/{pdf_id}")
async def update_digital_pdf(pdf_id: str, body: DigitalPdfIn, user: dict = Depends(require_admin)):
    update = body.model_dump()
    # normalize drive link -> store file id only
    file_id = _extract_drive_file_id(update.get("drive_link") or "")
    if not file_id:
        raise HTTPException(status_code=400, detail="Invalid Google Drive link")
    update["drive_file_id"] = file_id
    update.pop("drive_link", None)
    await db.digital_pdfs.update_one({"id": pdf_id}, {"$set": update})
    return await db.digital_pdfs.find_one({"id": pdf_id}, {"_id": 0})


@api.delete("/digital-store/{pdf_id}")
async def delete_digital_pdf(pdf_id: str, user: dict = Depends(require_admin)):
    await db.digital_pdfs.delete_one({"id": pdf_id})
    await db.purchases.delete_many({"pdf_id": pdf_id})
    return {"ok": True}


@api.post("/digital-store/{pdf_id}/publish")
async def publish_digital_pdf(pdf_id: str, user: dict = Depends(require_admin)):
    doc = await db.digital_pdfs.find_one({"id": pdf_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="PDF not found")
    await db.digital_pdfs.update_one({"id": pdf_id}, {"$set": {"published": True}})
    return {"ok": True}


@api.post("/digital-store/checkout/{pdf_id}")
async def digital_store_checkout(pdf_id: str, user: dict = Depends(get_current_user)):
    doc = await db.digital_pdfs.find_one({"id": pdf_id}, {"_id": 0})
    if not doc or not doc.get("published", False):
        raise HTTPException(status_code=404, detail="PDF not found")
    existing = await db.purchases.find_one({"user_id": user["id"], "pdf_id": pdf_id})
    if existing:
        return {"ok": True, "already": True}
    price = int((doc.get("price", 0) or 0) * 100)
    if price <= 0:
        raise HTTPException(status_code=400, detail="PDF is free — no checkout required")
    key_id, key_secret = get_razorpay_keys()
    short_id = new_id()[:12]
    payload = {
        "amount": price,
        "currency": doc.get("currency", "INR"),
        "receipt": f"pdf_{short_id}",
        "payment_capture": 1,
        "notes": {"pdf_id": pdf_id, "user_id": user["id"]},
    }
    async with httpx.AsyncClient(auth=(key_id, key_secret), timeout=30.0) as client:
        r = await client.post("https://api.razorpay.com/v1/orders", json=payload)
    if r.status_code != 200 and r.status_code != 201:
        raise HTTPException(status_code=502, detail=f"Razorpay order creation failed: {r.text}")
    order = r.json()
    return {"ok": True, "order": {"id": order.get("id"), "amount": order.get("amount"), "currency": order.get("currency")}, "key_id": key_id}


class PaymentVerifyPdfIn(BaseModel):
    razorpay_payment_id: str
    razorpay_order_id: str
    razorpay_signature: str
    pdf_id: str


@api.post("/digital-store/payments/verify")
async def digital_store_payments_verify(body: PaymentVerifyPdfIn, user: dict = Depends(get_current_user)):
    key_id, key_secret = get_razorpay_keys()
    msg = f"{body.razorpay_order_id}|{body.razorpay_payment_id}".encode()
    expected = hmac.new(key_secret.encode(), msg, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, body.razorpay_signature):
        raise HTTPException(status_code=400, detail="Invalid payment signature")
    async with httpx.AsyncClient(auth=(key_id, key_secret), timeout=30.0) as client:
        resp = await client.get(f"https://api.razorpay.com/v1/payments/{body.razorpay_payment_id}")
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail="Failed to fetch payment details from Razorpay")
    payinfo = resp.json()
    payment = {
        "id": new_id(),
        "user_id": user["id"],
        "pdf_id": body.pdf_id,
        "amount": payinfo.get("amount") / 100.0 if payinfo.get("amount") is not None else None,
        "currency": payinfo.get("currency"),
        "status": payinfo.get("status"),
        "provider": "razorpay",
        "provider_order_id": body.razorpay_order_id,
        "provider_payment_id": body.razorpay_payment_id,
        "provider_signature": body.razorpay_signature,
        "created_at": now_iso(),
    }
    await db.payments.insert_one(dict(payment))
    purchase = {"id": new_id(), "user_id": user["id"], "pdf_id": body.pdf_id, "payment_id": payment["id"], "created_at": now_iso()}
    await db.purchases.insert_one(dict(purchase))
    payment.pop("_id", None)
    return {"ok": True, "payment": payment, "purchase": purchase}


@api.get("/digital-store/purchases/me")
async def my_pdf_purchases(user: dict = Depends(get_current_user)):
    items = await db.purchases.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    out = []
    for p in items:
        pdf = await db.digital_pdfs.find_one({"id": p["pdf_id"]}, {"_id": 0})
        if not pdf:
            continue
        pdf.pop("drive_file_id", None)
        out.append({**p, "pdf": pdf})
    return out


@api.get("/digital-store/preview/{pdf_id}")
async def preview_pdf(pdf_id: str, user: dict = Depends(get_current_user)):
    pdf = await db.digital_pdfs.find_one({"id": pdf_id}, {"_id": 0})
    if not pdf or not pdf.get("published", False):
        raise HTTPException(status_code=404, detail="PDF not found")
    # Admin bypass
    if user.get("role") != "admin":
        purchased = await db.purchases.find_one({"user_id": user["id"], "pdf_id": pdf_id})
        if not purchased:
            raise HTTPException(status_code=402, detail="Purchase required to access this PDF")
    file_id = pdf.get("drive_file_id")
    if not file_id:
        raise HTTPException(status_code=500, detail="PDF file not available")
    # Fetch file from Google Drive (public/shared) via uc?export=download&id=
    url = f"https://drive.google.com/uc?export=download&id={file_id}"
    async with httpx.AsyncClient(timeout=60.0) as client:
        r = await client.get(url)
    if r.status_code != 200:
        raise HTTPException(status_code=502, detail="Failed to fetch PDF from storage")
    headers = {"Content-Type": "application/pdf", "Cache-Control": "no-store", "Content-Disposition": "inline"}
    return StarletteResponse(content=r.content, status_code=200, media_type="application/pdf", headers=headers)


@api.get("/digital-store/{pdf_id}")
async def get_digital_pdf(pdf_id: str, user: dict = Depends(get_current_user)):
    """Return a single PDF product's metadata (no PDF content). Used by the product
    details page so students can see title/description/price/thumbnail/buy state
    before any preview or purchase. Backend never exposes drive_file_id to non-admins.
    NOTE: This route is declared AFTER /digital-store/purchases/me and
    /digital-store/preview/{pdf_id} so FastAPI's path-matching order does not
    accidentally route 'purchases' or 'preview' as a pdf_id."""
    is_admin = user.get("role") == "admin"
    query = {"id": pdf_id} if is_admin else {"id": pdf_id, "published": True}
    doc = await db.digital_pdfs.find_one(query, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="PDF not found")
    if not is_admin:
        doc.pop("drive_file_id", None)
        purchased = await db.purchases.find_one({"user_id": user["id"], "pdf_id": pdf_id}, {"_id": 0})
        doc["is_purchased"] = bool(purchased)
    return doc



# ---------- Tests / MCQ ----------
@api.get("/tests")
async def list_tests(chapter_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    if chapter_id:
        ch = await db.chapters.find_one({"id": chapter_id}, {"_id": 0})
        if not ch:
            raise HTTPException(status_code=404, detail="Chapter not found")
        sub = await db.subjects.find_one({"id": ch["subject_id"]}, {"_id": 0}) if ch else None
        if sub:
            await ensure_batch_access(sub["batch_id"], user)
        q = {"chapter_id": chapter_id}
        tests = await db.tests.find(q, {"_id": 0}).to_list(1000)
    else:
        if user.get("role") == "admin":
            tests = await db.tests.find({}, {"_id": 0}).to_list(1000)
        else:
            enrolls = await db.enrollments.find({"student_id": user["id"]}, {"_id": 0}).to_list(1000)
            batch_ids = [e["batch_id"] for e in enrolls]
            subjects = await db.subjects.find({"batch_id": {"$in": batch_ids}}, {"_id": 0}).to_list(2000)
            chapter_ids = [c["id"] async for c in db.chapters.find({"subject_id": {"$in": [s["id"] for s in subjects]}})]
            tests = await db.tests.find({"chapter_id": {"$in": chapter_ids}}, {"_id": 0}).to_list(1000)
    if user.get("role") != "admin":
        for t in tests:
            for qd in t.get("questions", []):
                qd.pop("correct_index", None)
                qd.pop("explanation", None)
    return tests


# IMPORTANT: place more specific routes BEFORE /tests/{test_id}
@api.get("/tests/attempts/me")
async def my_attempts(user: dict = Depends(get_current_user)):
    return await db.test_attempts.find({"user_id": user["id"]}, {"_id": 0}).sort("submitted_at", -1).to_list(1000)


@api.post("/tests/submit")
async def submit_test(body: TestSubmitIn, user: dict = Depends(get_current_user)):
    test = await db.tests.find_one({"id": body.test_id}, {"_id": 0})
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    questions = test.get("questions", [])
    total = len(questions)
    correct = 0
    breakdown = []
    answer_map = {a.question_index: a.selected_index for a in body.answers}
    for idx, q in enumerate(questions):
        selected = answer_map.get(idx, -1)
        is_correct = selected == q["correct_index"]
        if is_correct:
            correct += 1
        breakdown.append(
            {
                "question": q["question"],
                "options": q["options"],
                "correct_index": q["correct_index"],
                "selected_index": selected,
                "is_correct": is_correct,
                "explanation": q.get("explanation", ""),
            }
        )
    score_pct = round((correct / total) * 100, 2) if total else 0
    attempt = {
        "id": new_id(),
        "test_id": body.test_id,
        "user_id": user["id"],
        "score": correct,
        "total": total,
        "score_pct": score_pct,
        "time_taken_seconds": body.time_taken_seconds,
        "submitted_at": now_iso(),
    }
    await db.test_attempts.insert_one(attempt)
    attempt.pop("_id", None)
    return {**attempt, "breakdown": breakdown, "test_title": test.get("title")}


@api.get("/tests/{test_id}")
async def get_test(test_id: str, user: dict = Depends(get_current_user)):
    t = await db.tests.find_one({"id": test_id}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="Test not found")
    # Enforce batch access by resolving chapter -> subject -> batch
    ch = await db.chapters.find_one({"id": t["chapter_id"]}, {"_id": 0}) if t else None
    sub = await db.subjects.find_one({"id": ch["subject_id"]}, {"_id": 0}) if ch else None
    if sub:
        await ensure_batch_access(sub["batch_id"], user)
    if user.get("role") != "admin":
        for qd in t.get("questions", []):
            qd.pop("correct_index", None)
            qd.pop("explanation", None)
    return t


@api.post("/tests")
async def create_test(body: TestIn, user: dict = Depends(require_admin)):
    doc = {"id": new_id(), **body.model_dump(), "created_at": now_iso()}
    await db.tests.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.put("/tests/{test_id}")
async def update_test(test_id: str, body: TestIn, user: dict = Depends(require_admin)):
    await db.tests.update_one({"id": test_id}, {"$set": body.model_dump()})
    return await db.tests.find_one({"id": test_id}, {"_id": 0})


@api.delete("/tests/{test_id}")
async def delete_test(test_id: str, user: dict = Depends(require_admin)):
    await db.tests.delete_one({"id": test_id})
    await db.test_attempts.delete_many({"test_id": test_id})
    return {"ok": True}


# ---------- Live Classes ----------
def _compute_status(item: dict) -> str:
    try:
        start = datetime.fromisoformat(item["start_time"].replace("Z", "+00:00"))
        diff = (start - datetime.now(timezone.utc)).total_seconds()
        if diff > 60 * 15:
            return "upcoming"
        if -60 * 60 * 2 <= diff <= 60 * 15:
            return "live"
        return "ended"
    except Exception:
        return "upcoming"


@api.get("/live-classes")
async def list_live_classes(batch_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    if batch_id:
        await ensure_batch_access(batch_id, user)
        q = {"batch_id": batch_id}
        items = await db.live_classes.find(q, {"_id": 0}).sort("start_time", 1).to_list(1000)
    else:
        if user.get("role") == "admin":
            items = await db.live_classes.find({}, {"_id": 0}).sort("start_time", 1).to_list(1000)
        else:
            enrolls = await db.enrollments.find({"student_id": user["id"]}, {"_id": 0}).to_list(1000)
            batch_ids = [e["batch_id"] for e in enrolls]
            items = await db.live_classes.find({"batch_id": {"$in": batch_ids}}, {"_id": 0}).sort("start_time", 1).to_list(1000)
    for it in items:
        it["status"] = _compute_status(it)
    return items


@api.post("/live-classes")
async def create_live_class(body: LiveClassIn, user: dict = Depends(require_admin)):
    doc = {"id": new_id(), **body.model_dump(), "created_at": now_iso()}
    await db.live_classes.insert_one(doc)
    doc.pop("_id", None)
    try:
        tokens = await get_all_fcm_tokens()
        if tokens:
            await send_fcm_message(
                tokens,
                f"Live class published: {doc['title']}",
                "A new live class has been scheduled. Join when it starts.",
                f"/live-classes",
                {"mode": "live_class", "entity_id": doc['id']},
            )
    except Exception as exc:
        logger.warning(f"Failed to send live class notification: {exc}")
    return doc


@api.put("/live-classes/{lc_id}")
async def update_live_class(lc_id: str, body: LiveClassIn, user: dict = Depends(require_admin)):
    await db.live_classes.update_one({"id": lc_id}, {"$set": body.model_dump()})
    return await db.live_classes.find_one({"id": lc_id}, {"_id": 0})


@api.delete("/live-classes/{lc_id}")
async def delete_live_class(lc_id: str, user: dict = Depends(require_admin)):
    await db.live_classes.delete_one({"id": lc_id})
    return {"ok": True}


@api.post("/live-classes/{lc_id}/publish-recording")
async def publish_recording(lc_id: str, user: dict = Depends(require_admin)):
    """Convert a live class' recording_url into a Video attached to its chapter."""
    lc = await db.live_classes.find_one({"id": lc_id}, {"_id": 0})
    if not lc:
        raise HTTPException(status_code=404, detail="Live class not found")
    if not lc.get("chapter_id"):
        raise HTTPException(status_code=400, detail="Live class has no chapter_id — set it first")
    if not lc.get("recording_url"):
        raise HTTPException(status_code=400, detail="No recording_url set on live class")
    # Already published?
    if lc.get("recording_video_id"):
        existing = await db.videos.find_one({"id": lc["recording_video_id"]}, {"_id": 0})
        if existing:
            return {"ok": True, "already": True, "video": existing}
    # Count existing videos in chapter for ordering
    count = await db.videos.count_documents({"chapter_id": lc["chapter_id"]})
    video = {
        "id": new_id(),
        "chapter_id": lc["chapter_id"],
        "title": f"[Recording] {lc['title']}",
        "description": lc.get("description") or "Recorded live class session.",
        "url": lc["recording_url"],
        "duration_seconds": lc.get("duration_seconds", 0),
        "order": count,
        "source_live_class_id": lc_id,
        "created_at": now_iso(),
    }
    await db.videos.insert_one(dict(video))
    await db.live_classes.update_one({"id": lc_id}, {"$set": {"recording_video_id": video["id"]}})
    video.pop("_id", None)
    try:
        tokens = await get_all_fcm_tokens()
        if tokens:
            await send_fcm_message(
                tokens,
                f"Recording published: {video['title']}",
                "A new recording has been uploaded to your course.",
                f"/videos/{video['id']}",
                {"mode": "content_upload", "entity_id": video['id']},
            )
    except Exception as exc:
        logger.warning(f"Failed to send recording notification: {exc}")
    return {"ok": True, "video": video}




# ---------- Enrollments ----------
@api.get("/enrollments/me")
async def my_enrollments(user: dict = Depends(get_current_user)):
    enrolls = await db.enrollments.find({"student_id": user["id"]}, {"_id": 0}).to_list(1000)
    batch_ids = [e["batch_id"] for e in enrolls]
    return await db.batches.find({"id": {"$in": batch_ids}}, {"_id": 0}).to_list(1000)


@api.post("/enrollments")
async def enroll(body: EnrollIn, user: dict = Depends(require_admin)):
    existing = await db.enrollments.find_one({"student_id": body.student_id, "batch_id": body.batch_id})
    if existing:
        return {"ok": True, "already": True}
    doc = {"id": new_id(), **body.model_dump(), "enrolled_at": now_iso()}
    await db.enrollments.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.post("/enrollments/self/{batch_id}")
async def self_enroll(batch_id: str, user: dict = Depends(get_current_user)):
    batch = await db.batches.find_one({"id": batch_id}, {"_id": 0})
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    # Block self-enroll for paid batches — must go through /payments/checkout
    if (batch.get("price") or 0) > 0:
        raise HTTPException(status_code=402, detail="This batch is paid. Please complete payment to enroll.")
    existing = await db.enrollments.find_one({"student_id": user["id"], "batch_id": batch_id})
    if existing:
        return {"ok": True, "already": True}
    doc = {"id": new_id(), "student_id": user["id"], "batch_id": batch_id, "enrolled_at": now_iso()}
    await db.enrollments.insert_one(doc)
    doc.pop("_id", None)
    return doc



# ---------- Payments (Razorpay integration) ----------

def get_razorpay_keys():
    key_id = os.environ.get("RAZORPAY_KEY_ID")
    key_secret = os.environ.get("RAZORPAY_KEY_SECRET")
    if not key_id or not key_secret:
        raise HTTPException(status_code=500, detail="Razorpay credentials not configured on server")
    return key_id, key_secret


async def _create_enrollment_for_user(user_id: str, batch_id: str, payment_id: str):
    existing = await db.enrollments.find_one({"student_id": user_id, "batch_id": batch_id})
    if existing:
        return {"ok": True, "already": True}
    enrollment = {"id": new_id(), "student_id": user_id, "batch_id": batch_id, "enrolled_at": now_iso(), "payment_id": payment_id}
    await db.enrollments.insert_one(dict(enrollment))
    enrollment.pop("_id", None)
    return enrollment


@api.post("/payments/checkout/{batch_id}")
async def payments_checkout(batch_id: str, user: dict = Depends(get_current_user)):
    """Create a Razorpay order and return order details for checkout on frontend."""
    batch = await db.batches.find_one({"id": batch_id}, {"_id": 0})
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    # Block if already enrolled
    existing = await db.enrollments.find_one({"student_id": user["id"], "batch_id": batch_id})
    if existing:
        return {"ok": True, "already": True}
    price = int((batch.get("price", 0) or 0) * 100)  # amount in paise
    if price <= 0:
        raise HTTPException(status_code=400, detail="Batch is free — use enroll endpoint")

    key_id, key_secret = get_razorpay_keys()
    # Receipt must be <= 40 chars for Razorpay
    short_id = new_id()[:12]  # Use first 12 chars of UUID
    payload = {
        "amount": price,
        "currency": batch.get("currency", "INR"),
        "receipt": f"ord_{short_id}",  # "ord_" (4) + 12 chars UUID = 16 chars total
        "payment_capture": 1,
        "notes": {"batch_id": batch_id, "user_id": user["id"]},
    }
    async with httpx.AsyncClient(auth=(key_id, key_secret), timeout=30.0) as client:
        r = await client.post("https://api.razorpay.com/v1/orders", json=payload)
    if r.status_code != 200 and r.status_code != 201:
        raise HTTPException(status_code=502, detail=f"Razorpay order creation failed: {r.text}")
    order = r.json()
    return {"ok": True, "order": {"id": order.get("id"), "amount": order.get("amount"), "currency": order.get("currency")}, "key_id": key_id}


class PaymentVerifyIn(BaseModel):
    razorpay_payment_id: str
    razorpay_order_id: str
    razorpay_signature: str
    batch_id: str


@api.post("/payments/verify")
async def payments_verify(body: PaymentVerifyIn, user: dict = Depends(get_current_user)):
    """Verify Razorpay payment signature and create payment record + enrollment."""
    key_id, key_secret = get_razorpay_keys()
    # Compute expected signature
    msg = f"{body.razorpay_order_id}|{body.razorpay_payment_id}".encode()
    expected = hmac.new(key_secret.encode(), msg, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, body.razorpay_signature):
        raise HTTPException(status_code=400, detail="Invalid payment signature")

    # Optional: fetch payment details from Razorpay to validate amount/status
    async with httpx.AsyncClient(auth=(key_id, key_secret), timeout=30.0) as client:
        resp = await client.get(f"https://api.razorpay.com/v1/payments/{body.razorpay_payment_id}")
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail="Failed to fetch payment details from Razorpay")
    payinfo = resp.json()
    # Record payment
    payment = {
        "id": new_id(),
        "user_id": user["id"],
        "batch_id": body.batch_id,
        "amount": payinfo.get("amount") / 100.0 if payinfo.get("amount") is not None else None,
        "currency": payinfo.get("currency"),
        "status": payinfo.get("status"),
        "provider": "razorpay",
        "provider_order_id": body.razorpay_order_id,
        "provider_payment_id": body.razorpay_payment_id,
        "provider_signature": body.razorpay_signature,
        "created_at": now_iso(),
    }
    await db.payments.insert_one(dict(payment))

    # Enroll student
    enrollment = await _create_enrollment_for_user(user["id"], body.batch_id, payment["id"])

    payment.pop("_id", None)
    return {"ok": True, "payment": payment, "enrollment": enrollment}


async def ensure_batch_access(batch_id: str, user: dict):
    # Admin bypass
    if user.get("role") == "admin":
        return True
    batch = await db.batches.find_one({"id": batch_id}, {"_id": 0})
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    # Free batch -> allowed
    if (batch.get("price") or 0) == 0:
        return True
    # Check enrollment
    enrolled = await db.enrollments.find_one({"student_id": user.get("id"), "batch_id": batch_id})
    if enrolled:
        return True
    raise HTTPException(status_code=402, detail="Purchase required to access this content")


@api.get("/payments/me")
async def my_payments(user: dict = Depends(get_current_user)):
    return await db.payments.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)


@api.get("/enrollments")
async def list_enrollments(batch_id: Optional[str] = None, user: dict = Depends(require_admin)):
    q = {"batch_id": batch_id} if batch_id else {}
    return await db.enrollments.find(q, {"_id": 0}).to_list(2000)


# ---------- Students ----------
@api.get("/students")
async def list_students(user: dict = Depends(require_admin)):
    students = await db.users.find({"role": "student"}, {"_id": 0, "password_hash": 0}).to_list(2000)
    for s in students:
        s["enrollment_count"] = await db.enrollments.count_documents({"student_id": s["id"]})
    return students


# ---------- Watch progress ----------
@api.post("/progress")
async def update_progress(body: WatchProgressIn, user: dict = Depends(get_current_user)):
    key = {"user_id": user["id"], "video_id": body.video_id}
    update = {
        **key,
        "position_seconds": body.position_seconds,
        "duration_seconds": body.duration_seconds,
        "updated_at": now_iso(),
    }
    await db.progress.update_one(key, {"$set": update}, upsert=True)
    return {"ok": True}


@api.get("/progress/me")
async def my_progress(user: dict = Depends(get_current_user)):
    return await db.progress.find({"user_id": user["id"]}, {"_id": 0}).to_list(1000)


@api.get("/progress/continue-watching")
async def continue_watching(user: dict = Depends(get_current_user)):
    items = await db.progress.find({"user_id": user["id"]}, {"_id": 0}).sort("updated_at", -1).to_list(10)
    out = []
    for p in items:
        v = await db.videos.find_one({"id": p["video_id"]}, {"_id": 0})
        if not v:
            continue
        ch = await db.chapters.find_one({"id": v["chapter_id"]}, {"_id": 0})
        sub = await db.subjects.find_one({"id": ch["subject_id"]}, {"_id": 0}) if ch else None
        out.append({**p, "video": v, "chapter": ch, "subject": sub})
    return out


# ---------- Dashboards ----------
@api.get("/dashboard/student")
async def student_dashboard(user: dict = Depends(get_current_user)):
    enrolls = await db.enrollments.find({"student_id": user["id"]}, {"_id": 0}).to_list(100)
    batch_ids = [e["batch_id"] for e in enrolls]
    batches = await db.batches.find({"id": {"$in": batch_ids}}, {"_id": 0}).to_list(100)
    subjects = await db.subjects.find({"batch_id": {"$in": batch_ids}}, {"_id": 0}).to_list(200)
    chapter_ids = [c["id"] async for c in db.chapters.find({"subject_id": {"$in": [s["id"] for s in subjects]}})]
    latest_notes = (
        await db.notes.find({"chapter_id": {"$in": chapter_ids}}, {"_id": 0}).sort("created_at", -1).to_list(6)
    )
    latest_tests = (
        await db.tests.find({"chapter_id": {"$in": chapter_ids}}, {"_id": 0}).sort("created_at", -1).to_list(6)
    )
    for t in latest_tests:
        for q in t.get("questions", []):
            q.pop("correct_index", None)
            q.pop("explanation", None)
    live_raw = (
        await db.live_classes.find({"batch_id": {"$in": batch_ids}}, {"_id": 0}).sort("start_time", 1).to_list(50)
    )
    live_upcoming = []
    for it in live_raw:
        it["status"] = _compute_status(it)
        if it["status"] in ("upcoming", "live"):
            live_upcoming.append(it)
    return {
        "user": user,
        "batches": batches,
        "live_classes": live_upcoming[:10],
        "latest_notes": latest_notes,
        "latest_tests": latest_tests,
    }


@api.get("/dashboard/admin")
async def admin_dashboard(user: dict = Depends(require_admin)):
    return {
        "counts": {
            "batches": await db.batches.count_documents({}),
            "subjects": await db.subjects.count_documents({}),
            "chapters": await db.chapters.count_documents({}),
            "videos": await db.videos.count_documents({}),
            "notes": await db.notes.count_documents({}),
            "tests": await db.tests.count_documents({}),
            "students": await db.users.count_documents({"role": "student"}),
            "live_classes": await db.live_classes.count_documents({}),
        }
    }


# ---------- Image Upload ----------
ALLOWED_IMAGE_MIME = {"image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"}
MAX_IMAGE_BYTES = 4 * 1024 * 1024  # 4 MB


@api.post("/uploads/image")
async def upload_image(file: UploadFile = File(...), user: dict = Depends(require_admin)):
    content = await file.read()
    if len(content) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=400, detail="Image too large (max 4MB)")
    if file.content_type not in ALLOWED_IMAGE_MIME:
        raise HTTPException(status_code=400, detail="Unsupported image type")
    image_id = new_id()
    await db.images.insert_one(
        {
            "id": image_id,
            "mime": file.content_type,
            "data": base64.b64encode(content).decode("ascii"),
            "uploaded_by": user["id"],
            "created_at": now_iso(),
        }
    )
    return {"id": image_id, "url": f"/api/images/{image_id}"}


@api.get("/images/{image_id}")
async def get_image(image_id: str):
    doc = await db.images.find_one({"id": image_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Image not found")
    data = base64.b64decode(doc["data"])
    return StarletteResponse(
        content=data,
        media_type=doc["mime"],
        headers={"Cache-Control": "public, max-age=2592000, immutable"},
    )


# ---------- Recently Viewed ----------
@api.get("/progress/recently-viewed")
async def recently_viewed(user: dict = Depends(get_current_user)):
    items = await db.progress.find({"user_id": user["id"]}, {"_id": 0}).sort("updated_at", -1).to_list(15)
    out = []
    for p in items:
        v = await db.videos.find_one({"id": p["video_id"]}, {"_id": 0})
        if not v:
            continue
        ch = await db.chapters.find_one({"id": v["chapter_id"]}, {"_id": 0})
        sub = await db.subjects.find_one({"id": ch["subject_id"]}, {"_id": 0}) if ch else None
        out.append({**p, "video": v, "chapter": ch, "subject": sub})
    return out


# ---------- Course Completion ----------
@api.get("/progress/completion/{batch_id}")
async def batch_completion(batch_id: str, user: dict = Depends(get_current_user)):
    subjects = await db.subjects.find({"batch_id": batch_id}, {"_id": 0}).to_list(200)
    subject_ids = [s["id"] for s in subjects]
    chapters = await db.chapters.find({"subject_id": {"$in": subject_ids}}, {"_id": 0}).to_list(500)
    chapter_ids = [c["id"] for c in chapters]
    videos = await db.videos.find({"chapter_id": {"$in": chapter_ids}}, {"_id": 0}).to_list(2000)
    total = len(videos)
    if total == 0:
        return {"batch_id": batch_id, "completed": 0, "total": 0, "pct": 0, "per_subject": []}
    video_ids = [v["id"] for v in videos]
    progress = await db.progress.find({"user_id": user["id"], "video_id": {"$in": video_ids}}, {"_id": 0}).to_list(5000)
    completed_set = {p["video_id"] for p in progress if p.get("duration_seconds") and p["position_seconds"] >= p["duration_seconds"] * 0.85}
    # per subject
    per_subject = []
    for s in subjects:
        s_chapter_ids = [c["id"] for c in chapters if c["subject_id"] == s["id"]]
        s_videos = [v for v in videos if v["chapter_id"] in s_chapter_ids]
        s_total = len(s_videos)
        s_done = sum(1 for v in s_videos if v["id"] in completed_set)
        per_subject.append({"id": s["id"], "name": s["name"], "color": s.get("color"), "completed": s_done, "total": s_total, "pct": round((s_done / s_total) * 100) if s_total else 0})
    return {
        "batch_id": batch_id,
        "completed": len(completed_set),
        "total": total,
        "pct": round((len(completed_set) / total) * 100, 1),
        "per_subject": per_subject,
    }


# ---------- Live Chat ----------
class ChatSendIn(BaseModel):
    live_class_id: str
    message: str = Field(min_length=1, max_length=500)


class ConnectionManager:
    def __init__(self):
        self.rooms: dict[str, list[dict]] = defaultdict(list)
        self.lock = asyncio.Lock()

    async def connect(self, room_id: str, ws: WebSocket, user: dict):
        await ws.accept()
        async with self.lock:
            self.rooms[room_id].append({"ws": ws, "user": user})
        await self.broadcast_presence(room_id)

    async def disconnect(self, room_id: str, ws: WebSocket):
        async with self.lock:
            self.rooms[room_id] = [c for c in self.rooms[room_id] if c["ws"] is not ws]
        await self.broadcast_presence(room_id)

    async def broadcast(self, room_id: str, payload: dict):
        dead = []
        for conn in list(self.rooms.get(room_id, [])):
            try:
                await conn["ws"].send_json(payload)
            except Exception:
                dead.append(conn["ws"])
        if dead:
            async with self.lock:
                self.rooms[room_id] = [c for c in self.rooms[room_id] if c["ws"] not in dead]

    async def broadcast_presence(self, room_id: str):
        await self.broadcast(room_id, {"type": "presence", "online": len(self.rooms.get(room_id, []))})


manager = ConnectionManager()


async def authenticate_token(token: str) -> Optional[dict]:
    if not token:
        return None
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["sub"]})
        if not user:
            return None
        user.pop("password_hash", None)
        user.pop("_id", None)
        return user
    except jwt.InvalidTokenError:
        return None


@app.websocket("/api/ws/chat/{live_class_id}")
async def chat_ws(websocket: WebSocket, live_class_id: str, token: str = ""):
    user = await authenticate_token(token)
    if not user:
        await websocket.close(code=4401)
        return
    lc = await db.live_classes.find_one({"id": live_class_id})
    if not lc:
        await websocket.close(code=4404)
        return
    await manager.connect(live_class_id, websocket, user)
    try:
        while True:
            data = await websocket.receive_json()
            mtype = data.get("type", "message")
            if mtype == "message":
                text = (data.get("message") or "").strip()
                if not text or len(text) > 500:
                    continue
                msg = {
                    "id": new_id(),
                    "live_class_id": live_class_id,
                    "user_id": user["id"],
                    "user_name": user["name"],
                    "user_role": user["role"],
                    "user_avatar": user.get("avatar_url"),
                    "message": text,
                    "pinned": False,
                    "created_at": now_iso(),
                }
                await db.chat_messages.insert_one(dict(msg))
                msg.pop("_id", None)
                await manager.broadcast(live_class_id, {"type": "message", "message": msg})
            elif mtype == "pin":
                if user["role"] != "admin":
                    continue
                msg_id = data.get("message_id")
                doc = await db.chat_messages.find_one({"id": msg_id, "live_class_id": live_class_id})
                if not doc:
                    continue
                new_pinned = not doc.get("pinned", False)
                await db.chat_messages.update_one({"id": msg_id}, {"$set": {"pinned": new_pinned}})
                await manager.broadcast(live_class_id, {"type": "pin", "message_id": msg_id, "pinned": new_pinned})
            elif mtype == "delete":
                if user["role"] != "admin":
                    continue
                msg_id = data.get("message_id")
                await db.chat_messages.delete_one({"id": msg_id, "live_class_id": live_class_id})
                await manager.broadcast(live_class_id, {"type": "delete", "message_id": msg_id})
    except WebSocketDisconnect:
        pass
    finally:
        await manager.disconnect(live_class_id, websocket)


@api.get("/chat/{live_class_id}/history")
async def chat_history(live_class_id: str, user: dict = Depends(get_current_user)):
    msgs = await db.chat_messages.find({"live_class_id": live_class_id}, {"_id": 0}).sort("created_at", 1).to_list(500)
    online = len(manager.rooms.get(live_class_id, []))
    return {"messages": msgs, "online": online}


@api.delete("/chat/messages/{message_id}")
async def delete_chat_message(message_id: str, user: dict = Depends(require_admin)):
    await db.chat_messages.delete_one({"id": message_id})
    return {"ok": True}




app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=get_cors_origins(),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("lms")


# ---------- Seed ----------
async def seed_users():
    admin_email = os.environ["ADMIN_EMAIL"].lower()
    admin_pw = os.environ["ADMIN_PASSWORD"]
    student_email = os.environ["STUDENT_EMAIL"].lower()
    student_pw = os.environ["STUDENT_PASSWORD"]

    existing_admin = await db.users.find_one({"email": admin_email})
    if not existing_admin:
        await db.users.insert_one(
            {
                "id": new_id(),
                "email": admin_email,
                "name": "Admin",
                "password_hash": hash_password(admin_pw),
                "role": "admin",
                "avatar_url": "https://images.unsplash.com/photo-1513258496099-48168024aec0?auto=format&fit=crop&q=80&w=200",
                "created_at": now_iso(),
            }
        )
    elif not verify_password(admin_pw, existing_admin["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_pw)}})

    existing_student = await db.users.find_one({"email": student_email})
    if not existing_student:
        await db.users.insert_one(
            {
                "id": new_id(),
                "email": student_email,
                "name": "Aarav Sharma",
                "password_hash": hash_password(student_pw),
                "role": "student",
                "avatar_url": "https://images.unsplash.com/photo-1515378960530-7c0da6231fb1?auto=format&fit=crop&q=80&w=200",
                "created_at": now_iso(),
            }
        )
    elif not verify_password(student_pw, existing_student["password_hash"]):
        await db.users.update_one({"email": student_email}, {"$set": {"password_hash": hash_password(student_pw)}})


async def seed_content():
    student = await db.users.find_one({"email": os.environ["STUDENT_EMAIL"].lower()})

    batches_data = [
        {
            "name": "NEET 2027 - Lakshya",
            "description": "Complete two-year course for NEET 2027 aspirants. Physics, Chemistry, Biology with full coverage.",
            "cover_url": "https://images.unsplash.com/photo-1576086213369-97a306d36557?auto=format&fit=crop&q=85&w=1200",
            "target_exam": "NEET",
            "year": 2027,
            "price": 4999,
            "currency": "INR",
        },
        {
            "name": "JEE 2027 - Arjuna",
            "description": "Rigorous JEE Main + Advanced preparation. Physics, Chemistry, Mathematics.",
            "cover_url": "https://images.unsplash.com/photo-1635372722656-389f87a941b7?auto=format&fit=crop&q=85&w=1200",
            "target_exam": "JEE",
            "year": 2027,
            "price": 5999,
            "currency": "INR",
        },
        {
            "name": "Class 10 Foundation",
            "description": "Strong fundamentals in Science and Mathematics for CBSE Class 10.",
            "cover_url": "https://images.pexels.com/photos/12732215/pexels-photo-12732215.jpeg?auto=format&fit=crop&q=85&w=1200",
            "target_exam": "CBSE",
            "year": 2026,
            "price": 0,
            "currency": "INR",
        },
    ]

    neet_subjects = [
        {"name": "Physics", "icon": "Atom", "color": "#1E3A8A", "cover_url": "https://images.unsplash.com/photo-1635372722656-389f87a941b7?auto=format&fit=crop&q=85&w=800"},
        {"name": "Chemistry", "icon": "FlaskConical", "color": "#16A34A", "cover_url": "https://images.unsplash.com/photo-1532634922-8fe0b757fb13?auto=format&fit=crop&q=85&w=800"},
        {"name": "Biology", "icon": "Leaf", "color": "#C92A2A", "cover_url": "https://images.unsplash.com/photo-1530026405186-ed1f139313f8?auto=format&fit=crop&q=85&w=800"},
    ]
    jee_subjects = [
        {"name": "Physics", "icon": "Atom", "color": "#1E3A8A", "cover_url": "https://images.unsplash.com/photo-1635372722656-389f87a941b7?auto=format&fit=crop&q=85&w=800"},
        {"name": "Chemistry", "icon": "FlaskConical", "color": "#16A34A", "cover_url": "https://images.unsplash.com/photo-1532634922-8fe0b757fb13?auto=format&fit=crop&q=85&w=800"},
        {"name": "Mathematics", "icon": "Sigma", "color": "#F59E0B", "cover_url": "https://images.unsplash.com/photo-1509228468518-180dd4864904?auto=format&fit=crop&q=85&w=800"},
    ]
    cbse_subjects = [
        {"name": "Science", "icon": "Microscope", "color": "#16A34A", "cover_url": "https://images.unsplash.com/photo-1532634922-8fe0b757fb13?auto=format&fit=crop&q=85&w=800"},
        {"name": "Mathematics", "icon": "Sigma", "color": "#F59E0B", "cover_url": "https://images.unsplash.com/photo-1509228468518-180dd4864904?auto=format&fit=crop&q=85&w=800"},
    ]

    chapters_map = {
        "Physics": ["Kinematics", "Laws of Motion", "Electricity & Magnetism", "Modern Physics"],
        "Chemistry": ["Atomic Structure", "Organic Chemistry Basics", "Chemical Bonding", "Thermodynamics"],
        "Biology": ["Cell Structure", "Human Physiology", "Genetics", "Plant Kingdom"],
        "Mathematics": ["Algebra", "Trigonometry", "Calculus", "Coordinate Geometry"],
        "Science": ["Light & Reflection", "Acids and Bases", "Life Processes", "Electricity"],
    }

    sample_videos = [
        {"title": "Introduction & Overview", "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "duration_seconds": 720},
        {"title": "Core Concepts Explained", "url": "https://www.youtube.com/watch?v=jNQXAC9IVRw", "duration_seconds": 1200},
        {"title": "Solved Examples", "url": "https://www.youtube.com/watch?v=9bZkp7q19f0", "duration_seconds": 980},
        {"title": "Practice Problems Walkthrough", "url": "https://www.youtube.com/watch?v=kJQP7kiw5Fk", "duration_seconds": 1500},
    ]

    sample_questions_pool = [
        {"question": "Which of the following is a vector quantity?", "options": ["Speed", "Velocity", "Mass", "Temperature"], "correct_index": 1, "explanation": "Velocity has both magnitude and direction."},
        {"question": "What is the SI unit of force?", "options": ["Joule", "Pascal", "Newton", "Watt"], "correct_index": 2, "explanation": "Force is measured in Newtons (N)."},
        {"question": "Which subatomic particle has no charge?", "options": ["Proton", "Neutron", "Electron", "Positron"], "correct_index": 1, "explanation": "Neutrons are electrically neutral."},
        {"question": "The derivative of sin(x) is:", "options": ["-cos(x)", "cos(x)", "-sin(x)", "tan(x)"], "correct_index": 1, "explanation": "d/dx[sin(x)] = cos(x)."},
        {"question": "What is the powerhouse of the cell?", "options": ["Nucleus", "Ribosome", "Mitochondria", "Golgi apparatus"], "correct_index": 2, "explanation": "Mitochondria produce ATP."},
    ]

    for bdata in batches_data:
        # Remove any previous seeded batch with same name to ensure deterministic seeding
        existing_batch = await db.batches.find_one({"name": bdata["name"]})
        if existing_batch:
            # cascade delete existing seeded batch and its children
            bid = existing_batch["id"]
            subject_ids = [s["id"] async for s in db.subjects.find({"batch_id": bid})]
            chapter_ids = [c["id"] async for c in db.chapters.find({"subject_id": {"$in": subject_ids}})]
            await db.batches.delete_one({"id": bid})
            await db.subjects.delete_many({"batch_id": bid})
            await db.chapters.delete_many({"subject_id": {"$in": subject_ids}})
            await db.videos.delete_many({"chapter_id": {"$in": chapter_ids}})
            await db.notes.delete_many({"chapter_id": {"$in": chapter_ids}})
            await db.tests.delete_many({"chapter_id": {"$in": chapter_ids}})
            await db.live_classes.delete_many({"batch_id": bid})
            await db.enrollments.delete_many({"batch_id": bid})
        # proceed to insert fresh copy
        b = {"id": new_id(), **bdata, "created_at": now_iso()}
        await db.batches.insert_one(dict(b))

        if "NEET" in b["name"]:
            sub_list = neet_subjects
        elif "JEE" in b["name"]:
            sub_list = jee_subjects
        else:
            sub_list = cbse_subjects

        for sdata in sub_list:
            sub = {"id": new_id(), "batch_id": b["id"], **sdata, "created_at": now_iso()}
            await db.subjects.insert_one(dict(sub))
            chapters = chapters_map.get(sdata["name"], ["Chapter 1", "Chapter 2", "Chapter 3"])
            for order, cname in enumerate(chapters):
                ch = {"id": new_id(), "subject_id": sub["id"], "name": cname, "order": order, "created_at": now_iso()}
                await db.chapters.insert_one(dict(ch))
                for vo, vd in enumerate(sample_videos):
                    await db.videos.insert_one(
                        {
                            "id": new_id(),
                            "chapter_id": ch["id"],
                            "title": f"{cname}: {vd['title']}",
                            "description": f"Lesson on {cname} — {vd['title']}.",
                            "url": vd["url"],
                            "duration_seconds": vd["duration_seconds"],
                            "order": vo,
                            "created_at": now_iso(),
                        }
                    )
                await db.notes.insert_one(
                    {
                        "id": new_id(),
                        "chapter_id": ch["id"],
                        "title": f"{cname} - Quick Revision Notes",
                        "description": "Concise notes covering all key formulas and concepts.",
                        "url": "https://www.africau.edu/images/default/sample.pdf",
                        "created_at": now_iso(),
                    }
                )
                await db.notes.insert_one(
                    {
                        "id": new_id(),
                        "chapter_id": ch["id"],
                        "title": f"{cname} - Practice Worksheet",
                        "description": "Practice problems with solutions.",
                        "url": "https://www.africau.edu/images/default/sample.pdf",
                        "created_at": now_iso(),
                    }
                )
                await db.tests.insert_one(
                    {
                        "id": new_id(),
                        "chapter_id": ch["id"],
                        "title": f"{cname} - Chapter Test",
                        "description": f"Test your understanding of {cname}.",
                        "duration_minutes": 10,
                        "questions": sample_questions_pool,
                        "created_at": now_iso(),
                    }
                )

        first_subject = await db.subjects.find_one({"batch_id": b["id"]}, {"_id": 0})
        await db.live_classes.insert_one(
            {
                "id": new_id(),
                "title": f"{b['name']} - Doubt Solving Session",
                "batch_id": b["id"],
                "subject_id": first_subject["id"] if first_subject else None,
                "youtube_url": "https://www.youtube.com/watch?v=jfKfPfyJRdk",
                "start_time": (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat(),
                "description": "Live doubt clearing session. Bring your questions!",
                "created_at": now_iso(),
            }
        )
        if student:
            await db.enrollments.insert_one(
                {"id": new_id(), "student_id": student["id"], "batch_id": b["id"], "enrolled_at": now_iso()}
            )


@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    await db.batches.create_index("id", unique=True)
    await db.subjects.create_index("id", unique=True)
    await db.chapters.create_index("id", unique=True)
    await db.videos.create_index("id", unique=True)
    await db.notes.create_index("id", unique=True)
    await db.tests.create_index("id", unique=True)
    await db.live_classes.create_index("id", unique=True)
    await db.enrollments.create_index([("student_id", 1), ("batch_id", 1)])
    await db.batches.update_many({"price": {"$exists": False}}, {"$set": {"price": 0}})
    await db.batches.update_many({"currency": {"$exists": False}}, {"$set": {"currency": "INR"}})
    await seed_users()
    # seed_content() cascade-deletes any existing batches named "NEET 2027 - Lakshya",
    # "JEE 2027 - Arjuna", "Class 10 Foundation" and their entire content tree on every
    # startup. Guarded behind SEED_CONTENT=true so it never runs against production data
    # unless explicitly opted in.
    if os.environ.get("SEED_CONTENT", "false").lower() == "true":
        await seed_content()
    logger.info("LMS startup complete")


@app.on_event("shutdown")
async def on_shutdown():
    client.close()
