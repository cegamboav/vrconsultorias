# WhatsApp Agent CLI + Claude Integration Design

**Date:** 2026-05-14
**Branch:** Kane
**Related issue:** #1 — Módulo de Seguimiento por WhatsApp (extension)
**Status:** Approved

---

## Context

The CRM already has a rule-based WhatsApp follow-up agent (implemented in Phase 1 of issue #1) that uses fixed templates keyed by `(status, followUpReason)`. This design extends that foundation with:

1. A **CLI** in the backend exposing CRM operations as shell commands — useful for human admins, automated testing, and as the tool interface for an AI agent.
2. A **Claude API agent** (`claude-followup-agent.js`) that uses the CLI via the Bash tool to run a personalized, context-aware follow-up cycle.
3. **Skill files** (markdown) that teach the Claude agent how to use the CLI, understand the business context, and write appropriate WhatsApp messages.

The rule-based agent is kept as the default. The Claude agent is an opt-in upgrade activated via env var.

---

## Architecture

```
Cron / POST /api/private/follow-up-agent/run
          │
          ▼
  follow-up.scheduler.js
  reads FOLLOW_UP_AGENT_MODE
          │
    ┌─────┴──────┐
    │            │
rule-based    claude
(existing)       │
             claude-followup-agent.js
             loads skills → builds system_prompt
             calls Claude API (tools=[bash])
                  │
      ┌───────────┤
      │           │
  bash call    bash call
      │           │
      ▼           ▼
  apps/backend/cli.js
  (Node.js CLI — direct Prisma access, no HTTP)
          │
          ▼
  leads.service.js / follow-up-agent.service.js / Prisma / DB
```

---

## Components

### 1. CLI (`apps/backend/cli.js` + `src/cli/leads.commands.js`)

Entrypoint: `node cli.js <command> [args]`

All commands output **JSON to stdout**. Errors go to stderr with non-zero exit code. Auth: direct Prisma access (no JWT required — CLI is a trusted internal tool).

Add npm script: `"cli": "node cli.js"` so it's callable as `npm run cli --workspace @crm/backend -- leads list-due`.

#### Commands

| Command | Options | Output |
|---|---|---|
| `leads list-due` | `--limit N` (default 50) | `{ leads: [{ id, fullName, phone, followUpReason, nextActionDate, owner: { name, calendly } }] }` |
| `leads get <id>` | — | `{ lead: { ...allFields, activities: [...last15] } }` |
| `leads send-whatsapp <id>` | `--message "text"`, `--dry-run` | `{ status, activityId, dryRun, phone }` |
| `leads add-note <id>` | `--text "note text"` | `{ activityId }` |
| `leads update-status <id>` | `--status STATUS` (valid values: CONTACTED, SCHEDULED, FOLLOW_UP, CLOSED_INVESTED, CLOSED_NOT_INVESTED) | `{ lead: { id, status } }` |
| `leads reschedule <id>` | `--days N` or `--date YYYY-MM-DD` (min 7 days out) | `{ lead: { id, nextActionDate } }` |

Error response shape: `{ error: "human-readable message", code: "ERROR_CODE" }` on stderr.

The CLI reuses existing service functions (`addLeadActivity`, `updateLead`, `changeLeadStatus`) — no new business logic. The `send-whatsapp` command calls the `whatsappProvider.sendTemplate()` + writes `WHATSAPP_SENT` activity (same flow as the rule-based agent).

### 2. Skills (`apps/backend/src/agent/skills/`)

Four markdown files loaded at agent startup. All are concatenated into the Claude system prompt.

| File | Content |
|---|---|
| `crm-overview.md` | VR Consultorías business context, who leads are, what the CRM does, lead status lifecycle |
| `cli-reference.md` | All 6 CLI commands with exact syntax, sample JSON inputs/outputs, error codes |
| `followup-workflow.md` | Step-by-step agent workflow: run list-due → for each lead, read context → decide action → send or reschedule → add note |
| `message-guidelines.md` | WhatsApp message rules: tone (warm, professional), personalization hints, when to mention Calendly, SOUL values (honesty, empathy, no pressure), max length |

### 3. Claude Agent Runtime (`apps/backend/src/agent/claude-followup-agent.js`)

```
runClaudeAgent({ dryRun, limit }) → { processed, skipped, errors }
```

**Steps:**
1. Load all skill files from `src/agent/skills/` and join into system prompt.
2. Build initial user message: "Run the follow-up cycle. Today is {date}. Limit: {limit} leads. DryRun: {dryRun}."
3. Call Claude API (`claude-opus-4-7` or configurable via `CLAUDE_AGENT_MODEL`) with `tools=[{ type: "bash_20250124" }]` and `max_tokens=4096`.
4. **Agentic loop:** while last message has `tool_use`:
   - For each `tool_use(bash)`, execute `node cli.js <command>` in a child process with stdout/stderr capture.
   - Feed result back as `tool_result`.
   - Call Claude API again with updated messages.
5. Parse Claude's final text response to extract `{ processed, skipped, errors }` summary (or build it from activity logs).
6. Return summary.

**Safety constraints passed via system prompt:**
- Max 50 WhatsApp messages per cycle (enforced by `--limit`)
- Must call `list-due` first, never contact a lead not on the list
- Must add a note after every action (audit trail)
- Respect `--dry-run` flag: if true, never call `send-whatsapp` without `--dry-run`

**New env vars:**
```
FOLLOW_UP_AGENT_MODE=rule-based   # 'rule-based' | 'claude' | 'both'
CLAUDE_AGENT_MODEL=claude-opus-4-7
ANTHROPIC_API_KEY=                # required only when MODE=claude
```

### 4. Config + Scheduler Updates

`config/env.js` — add:
```js
followUpAgent: {
  ...existing fields,
  mode: process.env.FOLLOW_UP_AGENT_MODE ?? 'rule-based',
  claudeModel: process.env.CLAUDE_AGENT_MODEL ?? 'claude-opus-4-7',
}
```

`follow-up.scheduler.js` — switch on `env.followUpAgent.mode`:
- `'rule-based'` → `runOnce()` (existing)
- `'claude'` → `runClaudeAgent()`
- `'both'` → Claude runs first (personalized); rule-based runs after as safety net for any Claude errors. Since both check the `WHATSAPP_SENT` idempotency guard (via `nextActionDateAtSend` in activity metadata), rule-based will skip leads Claude already sent to. The CLI's `send-whatsapp` command MUST write the same `WHATSAPP_SENT` activity metadata format as `processLead()` to ensure the guard works correctly across both agents.

---

## Data Flow — One Lead Cycle (Claude mode)

```
Claude calls: bash "node cli.js leads list-due --limit 10"
→ CLI returns: { leads: [...] }

Claude picks lead #1, calls: bash "node cli.js leads get abc123"
→ CLI returns: { lead: { fullName: "Juan", followUpReason: "CALL_LATER", activities: [...] } }

Claude decides personalized message, calls:
  bash "node cli.js leads send-whatsapp abc123 --message 'Hola Juan, ...'"
→ CLI returns: { status: "DRY_RUN", activityId: "xyz" }

Claude calls: bash "node cli.js leads add-note abc123 --text 'Agente IA intentó contactar...'"
→ CLI returns: { activityId: "..." }

Claude moves to lead #2...
```

---

## Files to Create / Modify

### Create
- `apps/backend/cli.js` — CLI entrypoint (shebang + command routing)
- `apps/backend/src/cli/leads.commands.js` — command handlers
- `apps/backend/src/agent/claude-followup-agent.js` — Claude API agentic loop
- `apps/backend/src/agent/skills/crm-overview.md`
- `apps/backend/src/agent/skills/cli-reference.md`
- `apps/backend/src/agent/skills/followup-workflow.md`
- `apps/backend/src/agent/skills/message-guidelines.md`

### Modify
- `apps/backend/src/config/env.js` — add `followUpAgent.mode`, `followUpAgent.claudeModel`
- `apps/backend/src/jobs/follow-up.scheduler.js` — mode-based dispatch
- `apps/backend/package.json` — add `@anthropic-ai/sdk`, add `"cli": "node cli.js"` script
- `.env.example` — document new env vars

---

## Verification

1. `node cli.js leads list-due` returns valid JSON (with DB running).
2. `node cli.js leads get <real-id>` returns lead + activities.
3. `node cli.js leads send-whatsapp <id> --dry-run --message "test"` logs `WHATSAPP_SENT` activity with `dryRun: true`.
4. Set `FOLLOW_UP_AGENT_MODE=claude`, `ANTHROPIC_API_KEY=<real-key>`, `FOLLOW_UP_AGENT_DRY_RUN=false` → `POST /api/private/follow-up-agent/run` triggers the Claude agent, which calls the CLI and produces WHATSAPP_SENT activities.
5. Set `FOLLOW_UP_AGENT_MODE=rule-based` → existing behavior unchanged.
