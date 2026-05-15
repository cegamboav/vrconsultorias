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

# Tests (Node built-in runner, no external deps)
npm test --workspace @crm/backend   # runs phone.test.js + templates.es.test.js

# Quality
npm run lint
npm run format

# CLI (follow-up agent tool, used by Claude agent internally)
npm run cli --workspace @crm/backend -- leads list-due --limit 10
npm run cli --workspace @crm/backend -- leads send <leadId>
npm run cli --workspace @crm/backend -- leads note <leadId> --text "..."
```

## Architecture

**Monorepo workspaces:**
- `apps/frontend` — `@crm/frontend`
- `apps/backend` — `@crm/backend`
- `packages/database` — `@crm/database` (Prisma schema + generated client, shared by backend)

**Backend (`apps/backend/src/`):**
- `app.js` — Express app factory (Helmet, CORS, Morgan, routes)
- `server.js` — HTTP server entry point
- `config/env.js` — Validated env vars (single source of truth for all env access)
- `routes/` — Public: `auth`, `health`, `public/whatsapp-webhook`. Private (all under `/api/private/*` with `requireAuth`): `dashboard`, `leads`, `reports`, `follow-up-agent`
- `controllers/` → `services/` — Thin controllers, business logic in services
- `middlewares/auth.middleware.js` — `requireAuth` (JWT Bearer) + `requireRole(...roles)`
- `middlewares/verify-meta-signature.js` — Validates `X-Hub-Signature-256` on inbound WhatsApp webhooks
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

## WhatsApp Integration

Provider pattern in `services/whatsapp/`:
- `index.js` — singleton factory; picks provider from `WHATSAPP_PROVIDER` env var
- `noop.provider.js` — default dry-run provider (no network calls)
- `meta-cloud.provider.js` — Meta Cloud API provider
- `templates.es.js` — Spanish message template catalog with `getTemplate(status, reason)` and `interpolate(text, vars)`

Inbound webhook at `POST /webhooks/whatsapp` (public, no auth). Signature verified via `verify-meta-signature.js` middleware using `WHATSAPP_APP_SECRET`. On inbound messages the classifier runs (if enabled) and stores a suggested reply on the lead's `ActivityLog`.

## AI Subsystem

**Follow-up agent** (`agent/claude-followup-agent.js` + `jobs/follow-up.scheduler.js`):
- Runs on cron (default `0 9 * * *` America/Costa_Rica)
- Three modes via `FOLLOW_UP_AGENT_MODE`: `rule-based` (default), `claude`, `both`
- `claude` mode: agentic loop powered by Claude; calls the CRM CLI via `spawnSync` (no shell, injection-safe) using skills in `agent/skills/*.md`
- Always starts in `dryRun=true` unless `FOLLOW_UP_AGENT_DRY_RUN=false`

**Inbound classifier** (`services/inbound-classifier.service.js`):
- Classifies inbound WhatsApp messages and generates a suggested reply
- Uses `INBOUND_CLASSIFIER_MODEL` (default `claude-haiku-4-5-20251001`)
- Enabled only when `INBOUND_CLASSIFIER_ENABLED=true` and `ANTHROPIC_API_KEY` is set

## Environment

Copy `.env.example` → `.env`. Key vars:

| Var | Purpose |
|-----|---------|
| `DATABASE_URL` | Postgres connection string |
| `PORT` | Backend port (default `4000`) |
| `FRONTEND_URL` | CORS origin (default `http://localhost:5173`) |
| `JWT_SECRET` | JWT signing secret |
| `WHATSAPP_PROVIDER` | `noop` (default) or `meta` |
| `WHATSAPP_TOKEN` | Meta Cloud API token (required for `meta` provider) |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta phone number ID |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Token for Meta webhook verification challenge |
| `WHATSAPP_APP_SECRET` | Used to verify `X-Hub-Signature-256` on inbound webhooks |
| `ANTHROPIC_API_KEY` | Required for `claude` mode agent and inbound classifier |
| `CLAUDE_AGENT_MODEL` | Model ID for the Claude follow-up agent |
| `FOLLOW_UP_AGENT_ENABLED` | `true` to activate the scheduler |
| `FOLLOW_UP_AGENT_MODE` | `rule-based` / `claude` / `both` |
| `FOLLOW_UP_AGENT_DRY_RUN` | `false` to send real messages (default `true`) |
| `INBOUND_CLASSIFIER_ENABLED` | `true` to classify inbound WhatsApp messages |

Frontend reads `VITE_API_URL` (defaults to `http://localhost:4000`).
