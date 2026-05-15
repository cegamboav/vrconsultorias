# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

CRM de referidos para gestión de leads e inversiones. Stack: React + Vite + TailwindCSS (frontend), Node.js + Express (backend), PostgreSQL + Prisma (database). npm workspaces monorepo.

## Commands

```bash
# First-time setup
npm install && npm run db:up && npm run prisma:generate && npm run prisma:migrate

# Dev (frontend + backend in parallel)
npm run dev

# Individual services
npm run dev:frontend    # http://localhost:5173
npm run dev:backend     # http://localhost:4000

# Database
npm run db:up           # Start PostgreSQL + pgAdmin via Docker
npm run db:down         # Stop containers
npm run db:down:volumes # Full DB reset (destroys data)
npm run prisma:migrate  # Create/apply migrations (dev)
npm run prisma:studio   # Open Prisma Studio GUI
npm run seed            # Load seed data (admin@crmreferidos.local / admin123)

# Quality
npm run lint
npm run format
```

## Architecture

**Monorepo workspaces:**
- `apps/frontend` — `@crm/frontend`
- `apps/backend` — `@crm/backend`
- `packages/database` — `@crm/database` (Prisma schema + generated client, shared by backend)

**Backend (`apps/backend/src/`):**
- `app.js` — Express app factory (Helmet, CORS, Morgan, routes)
- `server.js` — HTTP server entry point
- `config/env.js` — Validated env vars (single source of truth)
- `routes/` — Public: `auth`, `health`. Private (all under `/api/private/*` with `requireAuth` middleware): `dashboard`, `leads`, `reports`
- `controllers/` → `services/` — Thin controllers, business logic in services
- `middlewares/auth.middleware.js` — `requireAuth` (JWT Bearer) + `requireRole(...roles)`
- `utils/app-error.js` — `AppError(message, statusCode)` for operational errors; caught by `error-handler.middleware.js`
- `utils/async-handler.js` — Wraps async route handlers; passes errors to Express error middleware

**Frontend (`apps/frontend/src/`):**
- Auth state lives in `features/auth/context/AuthContext.jsx` (JWT stored via `lib/tokenStorage.js`)
- All API calls go through `lib/apiClient.js` (`apiFetch`), which injects the Bearer token automatically
- `ProtectedRoute` redirects unauthenticated users to `/login`
- `app/config/navigation.js` drives the sidebar links
- Feature-level components in `features/leads/`, pages in `pages/app/`

**Database (`packages/database/`):**
- Schema in `prisma/schema.prisma`. Enums are exported from the package and imported directly by the backend services.
- Run `npm run prisma:generate` after any schema change before running the backend.

## Lead Pipeline

States: `NEW → CONTACTED → SCHEDULED → FOLLOW_UP → CLOSED_INVESTED / CLOSED_NOT_INVESTED`

Key rules enforced in `leads.service.js`:
- Transitions are strict (see `allowedTransitions` map); invalid transitions throw 400
- `CLOSED_NOT_INVESTED` requires `noInvestmentReason`
- `FOLLOW_UP` requires `nextActionDate` ≥ 7 days from today + a `followUpReason` enum value
- Phone is immutable (unique business identifier for deduplication)
- `leadNumber` is auto-incremented and display-only

## Environment

Copy `.env.example` → `.env`. Key vars: `DATABASE_URL`, `PORT=4000`, `FRONTEND_URL=http://localhost:5173`, `JWT_SECRET`, Postgres vars, pgAdmin vars.

Frontend reads `VITE_API_URL` (defaults to `http://localhost:4000`).
