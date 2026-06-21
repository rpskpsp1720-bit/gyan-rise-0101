# PRD — GYAN RISE RANA E-LEARNING (Imported from GitHub)

## Original Problem Statement
> https://github.com/skrajputchauhan01016353-afk/app.git
> "Clone and set up the existing code to run it. Import the existing code exactly as it is. Do not modify, refactor, redesign, or add features. Just analyze and preserve the current codebase unchanged."

## Tech Stack (detected)
- Backend: FastAPI + Motor (MongoDB async) + JWT auth + bcrypt + Razorpay + Firebase Admin (FCM)
- Frontend: React 19 + CRA/CRACO + Tailwind + Radix UI + react-router-dom 7 + Firebase Web SDK
- DB: MongoDB (local, `test_database`)

## What's been done (Jan 2026)
- Imported the GitHub repo exactly as-is into `/app` (backend, frontend, credentials/, design_guidelines.json, tests, etc.)
- Preserved protected `.env` values (MONGO_URL, DB_NAME, REACT_APP_BACKEND_URL)
- Added required env vars for the app to boot: `JWT_SECRET`, `ADMIN_EMAIL/PASSWORD`, `STUDENT_EMAIL/PASSWORD`, `CORS_ORIGINS`
- Credentials match the demo hints baked into the existing UI (`student@lms.com / student123`, `admin@lms.com / admin123`)
- Installed backend `requirements.txt` (firebase-admin, emergentintegrations, etc.) and ran `yarn install` for frontend
- Restarted supervisor; both backend & frontend are RUNNING
- Verified: `/api/auth/login` returns 200 for both admin and student; frontend `/login` page renders correctly

## Architecture
- Backend: `/app/backend/server.py` — single-file FastAPI app, all routes under `/api`
- Frontend: `/app/frontend/src/` — pages split by `student/` and `admin/`, AuthContext, AppLayout
- Routes (frontend): `/login`, `/admin-login`, `/register`, `/dashboard`, `/batches`, `/admin/*` etc.

## Optional integrations (left as-is, NOT configured)
The following env vars are referenced by the imported code but NOT set (left empty). The corresponding features will return errors if invoked, exactly matching the original repo behavior:
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` — paid batch checkout
- `FCM_SERVER_KEY` and `credentials/firebase-service-account.json` — push notifications
- Frontend Firebase Web config (`REACT_APP_FIREBASE_*`, `REACT_APP_FCM_VAPID_KEY`) — push notifications

User explicitly said "No change required, keep anything exactly as in the github repositories import only", so these are intentionally not configured.

## Backlog (for future iterations, only if user asks)
- P1: Configure Razorpay keys to enable paid-batch checkout flow
- P1: Configure Firebase service account + web config to enable FCM push notifications
- P2: Run testing agent on full feature surface
- P2: Build/deploy validations
