# Follow-Up Workflow

This document describes the exact steps you must follow during a follow-up cycle.

## Overview

Your job is to contact overdue FOLLOW_UP leads via WhatsApp and log every action.
Work through each lead methodically. Do not skip any step.

---

## Step-by-Step Process

### Step 1 — Discover due leads

Always start here. Never contact a lead that is not on this list.

```
node cli.js leads list-due --limit <limit>
```

If the result contains zero leads, the cycle is complete. Report:
```
Summary: processed=0, skipped=0, errors=0
```
and stop.

### Step 2 — Inspect each lead

For every lead returned by `list-due`, fetch full context before deciding what to do:

```
node cli.js leads get <id>
```

Read the `activities` array carefully:
- Was a WHATSAPP_SENT activity created recently (within the last 7 days)?
- Is the most recent activity a failed attempt?
- Does `followUpReason` suggest the lead is not ready?

### Step 3 — Decide: send or reschedule

**Send WhatsApp** when:
- No WHATSAPP_SENT activity in the last 7 days, AND
- The `followUpReason` does not indicate a long wait (e.g. NO_MONEY without a scheduled date)

**Reschedule** when:
- A WHATSAPP_SENT was already sent in the last 7 days (already processed for this cycle)
- The lead explicitly asked not to be contacted for an extended period

### Step 4a — Send WhatsApp

Write a personalized message (see `message-guidelines.md`). Always use `--message`
with a custom text — this gives you control over tone and personalization.

```
node cli.js leads send-whatsapp <id> --message "Hola Juan, ..." [--dry-run]
```

### Step 4b — Reschedule (if not sending)

```
node cli.js leads reschedule <id> --days 14
```

Use at least 14 days when rescheduling a lead that was already contacted recently.

### Step 5 — Always add a note

After EVERY action (send or reschedule), add a note to maintain the audit trail:

After sending:
```
node cli.js leads add-note <id> --text "Agente IA: WhatsApp enviado con mensaje personalizado"
```

After rescheduling:
```
node cli.js leads add-note <id> --text "Agente IA: reprogramado — ya fue contactado recientemente"
```

### Step 6 — Move to the next lead

Repeat Steps 2–5 for each lead from the `list-due` result.

### Step 7 — Final summary

When all leads are processed, output a summary line so the system can parse it:

```
Summary: processed=N, skipped=N, errors=N
```

Where:
- `processed` = leads that received a WhatsApp message
- `skipped` = leads that were rescheduled (already handled)
- `errors` = CLI commands that returned a non-zero exit code

---

## Safety Rules

1. **Always call `list-due` first** — never fabricate lead IDs or contact leads not on the list.
2. **Always add a note after every action** — this is mandatory for the audit trail.
3. **Respect dry-run** — if `DryRun: true`, all `send-whatsapp` calls must include `--dry-run`.
4. **Max leads per cycle** is controlled by `--limit` passed to `list-due` — do not exceed it.
5. **Do not change a lead's status** unless explicitly required — `send-whatsapp` and `add-note` are the primary actions.
6. **Do not call `update-status` with CLOSED_INVESTED or CLOSED_NOT_INVESTED** — those require human confirmation.

---

## Batching Tool Calls

You may process multiple CLI calls per turn to improve efficiency, but always wait
for the result of one call before deciding on the next action for the same lead.
You can issue `get` calls for multiple leads in parallel if they are independent.
