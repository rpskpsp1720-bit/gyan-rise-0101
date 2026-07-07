# GYAN RISE RANA E-Learning — PRD

## Original Problem Statement
Import full repo from https://github.com/akprit1612-bit/app.git and get the app running.

## Import Details
- Source: https://github.com/akprit1612-bit/app.git (public repo)
- Action: Full replacement of `/app` scaffold with cloned repo (preserving `.git` and `.emergent`).
- Goal after import: Just clone and get the app running.

## Tech Stack
- Backend: FastAPI (Python 3.11), Motor (async MongoDB driver), JWT auth (bcrypt), Razorpay + FCM/Firebase integration hooks
- Frontend: React 19 + CRACO + Tailwind + Radix UI + React Router 7, PWA (service worker), Capacitor Android wrapper
- Database: MongoDB (local via supervisor)

## Setup Completed (2026-01)
- Cloned repo into `/app`, preserved platform `.git`/`.emergent`.
- Installed backend `requirements.txt` (fastapi, motor, bcrypt, jwt, httpx, firebase-admin, etc.).
- Installed frontend dependencies via `yarn install` (canvas optional dep failed — safe to ignore, pdfjs-dist works without it).
- Created `/app/backend/.env` with:
  - `MONGO_URL`, `DB_NAME=gyan_rise_rana`, `JWT_SECRET`, `FRONTEND_URL`, `CORS_ORIGINS`
  - Seed users: `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `STUDENT_EMAIL`, `STUDENT_PASSWORD`
- Created `/app/frontend/.env` with `REACT_APP_BACKEND_URL` pointing to preview URL.
- Verified backend `/api/auth/login` returns JWT; frontend homepage renders (Sign-in page with hero).

## Core Features (already implemented in cloned repo)
- Auth: register/login/logout, forgot/reset/change password (JWT + httpOnly cookie)
- Content hierarchy: Batches → Subjects → Chapters → Videos / Notes / Tests
- Live Classes with YouTube URL + auto-status computation + optional recording publish
- Digital Store: paid PDFs with Razorpay checkout + Google Drive preview
- Batch enrollment: free self-enroll + Razorpay paid checkout + verify
- MCQ tests with scoring + attempts history
- Watch-progress + continue-watching + course completion %
- Admin dashboards, students list, batch/subject/chapter/video/notes/tests CRUD
- Push notifications via FCM (needs `FCM_SERVER_KEY` + Firebase config to work)
- Image upload (base64 in Mongo), PWA + service worker, capacitor Android build

## Integrations that need real API keys to activate (currently not configured)
- **Razorpay** — set `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET` in backend/.env for paid batches/PDFs.
- **FCM (Push notifications)** — set `FCM_SERVER_KEY` in backend/.env + Firebase Web config (`REACT_APP_FIREBASE_*`) in frontend/.env.
- **Firebase Admin SDK** — drop `firebase-service-account.json` in `/app/credentials/` if using server-side FCM v1.
- Without these keys, the app still runs end-to-end for all free content & auth flows.

## Test Credentials
See `/app/memory/test_credentials.md`

## Verified
- Backend `/api/auth/login` returns JWT for seeded admin ✓
- Frontend renders login/hero page ✓
- Supervisor: backend + frontend + mongodb all RUNNING ✓

## Next Action Items
- User to provide Razorpay + Firebase credentials if paid checkout & push notifications are required.
- Wire an email provider (SendGrid/Resend) for password-reset email delivery (currently only logged).
- Optionally run full E2E test via testing_agent once desired features are prioritized.
