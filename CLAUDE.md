# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FaidaKomori is a crowdfunding platform for the Comoros Islands (Union des Comores). It supports three fundraising models: **prévente** (pre-sale with delivery tracking), **dons** (donations/crowdfunding), and **investissement** (equity investment with share percentages). The currency is KMF (Franc Comorien).

## Running the Project

```bash
# Install dependencies (first time only)
cd backend && npm install

# Start the server
node backend/server.js
# or from root:
npm start
```

The server runs on **http://localhost:3001**. The backend serves both the API (`/api/*`) and all static HTML files from the project root.

Default admin account: `admin@faidakomori.km` / `Admin@FK2024!`

## Architecture

This is a **vanilla HTML/CSS/JS frontend** served by a **Node.js/Express backend**. There is no frontend framework, bundler, or build step — HTML pages are static files loaded directly by the browser.

### Backend (`backend/`)

- **`server.js`** — Express app setup: security middleware (Helmet, CORS, rate limiting), static file serving, route mounting, global error handler. Calls `db.init()` before listening.
- **`database.js`** — Dual-backend database abstraction layer. Uses **sql.js** (WASM SQLite) locally when `DATABASE_URL` is not set, and **PostgreSQL** (`pg`) in production (Neon/Supabase). Exposes a unified async API: `db.prepare(sql).get/all/run(...args)` using `?` placeholders (auto-converted to `$1,$2…` for PostgreSQL). The SQLite database file is persisted at `backend/db/faidakomori.db`.
- **`middleware/auth.js`** — Three JWT middlewares: `requireAuth` (blocks unauthenticated), `requireAdmin` (blocks non-admins), `optionalAuth` (injects `req.user` if token present but doesn't block).
- **`utils/auth.js`** — `signToken(user)` and `isValidEmail()`. JWT secret from `process.env.JWT_SECRET` (7-day expiry).
- **`utils/mailer.js`** — Nodemailer via Gmail. Silently skips if `EMAIL_PASS` is not configured. Templates: welcome, reset password, project status changes, interview scheduling, disbursement notifications.

### API Routes

| Prefix | Auth | File |
|---|---|---|
| `/api/auth` | public (rate-limited 20/15min) | `routes/auth.js` |
| `/api/projects` | public GET, auth POST | `routes/projects.js` |
| `/api/deposer` | public (combined register+project) | `routes/deposer.js` |
| `/api/user` | `requireAuth` | `routes/user.js` |
| `/api/admin` | `requireAdmin` | `routes/admin.js` |
| `/api/newsletter` | public | inline in `server.js` |
| `/api/health` | public | inline in `server.js` |

### Project Lifecycle (status field)

Projects flow through statuses managed by the admin: `new` → `review` → `interview` → `approved` → `published` (or `rejected` at any stage). The `note_admin` field is a JSON string that stores interview details and porteur responses.

### Frontend (`js/`, HTML pages)

- **`js/api.js`** — Single IIFE `API` object exposing all HTTP calls. Reads/writes `fk_token` and `fk_user` from `localStorage`. Also exports `requireLogin()`, `requireAdminAccess()`, and `initNavbarAuth()` (navbar injection with auth state). Every HTML page includes this script and calls `initNavbarAuth()` after `DOMContentLoaded`.
- **`js/main.js`** — Page-specific interactions (FAQ accordions, filters, etc.).
- **`js/currency.js`** — KMF currency formatting utilities.
- **`js/db-local.js`** — Legacy/test utility, not used by the main app.
- **`css/style.css`** — Main design. CSS variables defined on `:root`: `--navy` (#0D2244), `--green` (#00C853), `--gold` (#E8A020).
- **`css/design-v2.css`** — Secondary/experimental stylesheet.

### Key design patterns

- All backend SQL uses `?` placeholders — the `pgSql()` function in `database.js` converts them to `$1, $2…` for PostgreSQL. Always use `db.prepare(sql).get/all/run(...args)` and never interpolate values into SQL strings.
- Email sending always uses `.catch(() => {})` — mailer failures must never crash a request.
- The `POST /api/deposer` route is a combined endpoint that creates or logs in a user account and submits a project in one transaction, used by `deposer.html`.
- Contributions use optimistic counter updates (`montant_collecte`, `nb_contributeurs`) on the projects table.
- The `note_admin` column stores a JSON string; always `JSON.parse` with a try/catch fallback to `{}`.

## Environment Variables

Configure in `backend/.env` (not committed):

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (if absent, uses local sql.js SQLite) |
| `JWT_SECRET` | JWT signing secret (required in production) |
| `EMAIL_USER` | Gmail sender address |
| `EMAIL_PASS` | Gmail App Password |
| `SITE_URL` | Public URL used in email links |

## Deployment

Deployed on **Render** (configured in `render.yaml`): Node web service, Frankfurt region, free plan. Build: `npm install`, start: `npm start`. Health check: `/api/health`. PostgreSQL credentials (`DATABASE_URL`, `EMAIL_PASS`) are set as Render environment secrets.

**Important:** On Render's free plan, the SQLite file at `backend/db/faidakomori.db` is ephemeral and reset on each deploy. Production always uses `DATABASE_URL` (PostgreSQL).
