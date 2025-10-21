# Internet Museum of Feelings

A playful multi-room web experience featuring 10 exhibits.

Tech Stack
- Frontend: React + TypeScript + Vite + TailwindCSS + Framer Motion
- Backend: Node.js + Express + TypeScript + PostgreSQL
- DB: Local Postgres (dev) / Render Postgres (prod)
- Optional AI: Groq API for Oracle, Prompt Battle, Apology, Mood Mirror

Local Development
1) Install deps
- At repo root: `npm run install:all`

2) Set up env
- Copy `.env.example` to `backend/.env` (and optionally root `.env` for reference)

3) Start apps
- Root: `npm run dev`
- Frontend: `http://localhost:5173`
- API: `http://localhost:5000/api`
- Health: `http://localhost:5000/api/health`

Deployment
- Frontend (Netlify)
  - Build: `npm run build`
  - Publish dir: `frontend/dist`
  - Env: `VITE_API_URL=https://your-backend.onrender.com/api`

- Backend (Render)
  - Build: `npm install && npm run build`
  - Start: `npm start`
  - Env: `DATABASE_URL`, `GROQ_API_KEY`, `NODE_ENV=production`, `ADMIN_TOKEN`

Environment Variables (backend/.env)
```
DATABASE_URL=postgres://user:pass@host:5432/museum
PORT=5000
GROQ_API_KEY=your_key_here
NODE_ENV=development
FRONTEND_ORIGIN=http://localhost:5173
ADMIN_TOKEN=change-me
```

Environment Variables (frontend)
- `VITE_API_URL=http://localhost:5000/api`

Database Schema
Tables include:
- `graveyard`
- `confessions_booth`
- `void_stream_messages`
- `prompt_battles`
- `oracle_questions`
- `capsules`
- `apologies`
- `compliments`
- `dream_archive`
- `mood_mirror_readings`

Admin Panel
- Location: `/admin`
- Access: gated by admin password (token) from backend config
  - If `ADMIN_TOKEN` is not set, the admin panel runs in "open mode" (no password required).

Admin Authentication
- Login endpoint: `POST /api/admin/login`
  - Body: `{ "password": "<ADMIN_TOKEN>" }`
  - On success: `{ ok: true }`
- Protected endpoints require header: `Authorization: Bearer <ADMIN_TOKEN>`
- The frontend stores the token in `localStorage.adminToken` and sets it as the default Authorization header.

Change Admin Password
- In the Admin panel, use the "Admin Access" card to set a new password.
- Backend endpoint: `POST /api/admin/config/admin`
  - Body: `{ "token": "<new password>" }`
  - Persists the token to `site_config` (`ADMIN_TOKEN`) and takes effect immediately.
- Check configuration: `GET /api/admin/config/admin` → `{ configured: boolean }`

Logout
- Click the "Logout" button in the Admin panel header.
- This clears `localStorage.adminToken`, removes the `Authorization` header, and returns to the login screen.

Admin API Summary
- `POST /api/admin/login`
- `GET /api/admin/stats` (protected)
- `POST /api/admin/purge` (protected)
- `GET /api/admin/groq/models` (protected)
- `POST /api/admin/groq/test` (protected)
- `GET /api/admin/config/groq` (protected)
- `POST /api/admin/config/groq` (protected)
- `GET /api/admin/config/echo` (protected)
- `POST /api/admin/config/echo` (protected)
- `GET /api/admin/config/ambient` (protected)
- `POST /api/admin/config/ambient` (protected)
- `GET /api/admin/config/admin` (protected)
- `POST /api/admin/config/admin` (protected)

Notes
- In dev environments where PowerShell blocks `npm` scripts, you can run servers directly:
  - Backend: `node ./node_modules/ts-node-dev/lib/bin.js --respawn --transpile-only src/index.ts`
  - Frontend: `node ./node_modules/vite/bin/vite.js --port 5173`
- Make sure the frontend `VITE_API_URL` points to your backend (`http://localhost:<PORT>/api`).
