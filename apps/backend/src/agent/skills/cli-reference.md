# CLI Reference

All commands are invoked as:

```
node cli.js leads <command> [<id>] [options]
```

All output is JSON. Errors go to stderr with shape `{ "error": "...", "code": "..." }`.

---

## list-due

List all FOLLOW_UP leads whose `nextActionDate` is today or earlier.

```
node cli.js leads list-due [--limit N]
```

**Options:**
- `--limit N` — max results to return (default: 50)

**Example output:**
```json
{
  "leads": [
    {
      "id": "clxyz1234abcd",
      "leadNumber": 42,
      "fullName": "Juan Mora Solano",
      "phone": "+50688887777",
      "followUpReason": "THINKING",
      "nextActionDate": "2026-05-10T00:00:00.000Z",
      "owner": {
        "name": "Andrea Ramírez",
        "calendly": "https://calendly.com/andrea-ramirez"
      }
    }
  ]
}
```

---

## get

Get full details for a single lead, including the last 15 activities.

```
node cli.js leads get <id>
```

**Example output:**
```json
{
  "lead": {
    "id": "clxyz1234abcd",
    "leadNumber": 42,
    "fullName": "Juan Mora Solano",
    "phone": "+50688887777",
    "email": "juan@example.com",
    "status": "FOLLOW_UP",
    "source": "REFERIDO",
    "followUpReason": "THINKING",
    "followUpCount": 2,
    "nextActionDate": "2026-05-10T00:00:00.000Z",
    "lastActivityAt": "2026-04-28T14:22:00.000Z",
    "createdAt": "2026-03-15T09:00:00.000Z",
    "observations": "Interesado en inversión mínima de ₡5M",
    "owner": {
      "id": "user_abc",
      "name": "Andrea Ramírez",
      "calendly": "https://calendly.com/andrea-ramirez"
    },
    "activities": [
      {
        "id": "act_001",
        "type": "WHATSAPP_SENT",
        "description": "WhatsApp enviado: \"Hola Juan, ¿cómo está? Quería retomar nuestra conversaci...\"",
        "metadata": { "dryRun": false, "provider": "meta" },
        "createdAt": "2026-04-28T14:22:00.000Z"
      },
      {
        "id": "act_002",
        "type": "NOTE_ADDED",
        "description": "No contestó en la llamada del jueves",
        "metadata": { "source": "cli" },
        "createdAt": "2026-04-25T10:00:00.000Z"
      }
    ]
  }
}
```

---

## send-whatsapp

Send a WhatsApp message to a lead.

```
node cli.js leads send-whatsapp <id> [--message "custom text"] [--dry-run]
```

**Options:**
- `--message "text"` — custom message (skips template lookup)
- `--dry-run` — simulate send, does not deliver the message

If `--message` is omitted, the system resolves an automatic template based on `followUpReason`.

**Example output:**
```json
{
  "status": "SENT",
  "activityId": "act_abc123",
  "dryRun": false,
  "phone": "+50688887777"
}
```

When `--dry-run`:
```json
{
  "status": "DRY_RUN",
  "activityId": "act_abc123",
  "dryRun": true,
  "phone": "+50688887777"
}
```

---

## add-note

Append a note to the lead's activity log (creates a NOTE_ADDED activity).

```
node cli.js leads add-note <id> --text "note content"
```

**Example output:**
```json
{
  "activityId": "act_xyz789"
}
```

---

## update-status

Change the lead's status and record a STATUS_CHANGED activity.

```
node cli.js leads update-status <id> --status STATUS
```

**Valid statuses:** `CONTACTED`, `SCHEDULED`, `FOLLOW_UP`, `CLOSED_INVESTED`, `CLOSED_NOT_INVESTED`

**Example output:**
```json
{
  "lead": {
    "id": "clxyz1234abcd",
    "status": "CONTACTED"
  }
}
```

---

## reschedule

Update the lead's `nextActionDate`. Minimum 7 days from today.

```
node cli.js leads reschedule <id> --days N
node cli.js leads reschedule <id> --date YYYY-MM-DD
```

**Options (one required):**
- `--days N` — number of days from today (integer, >= 7)
- `--date YYYY-MM-DD` — absolute date (must be >= 7 days from today)

**Example output:**
```json
{
  "lead": {
    "id": "clxyz1234abcd",
    "nextActionDate": "2026-05-28T00:00:00.000Z"
  }
}
```

---

## Error codes

| Code              | Meaning                                      |
|-------------------|----------------------------------------------|
| MISSING_ID        | `<id>` argument not provided                 |
| NOT_FOUND         | Lead not found in database                   |
| MISSING_TEXT      | `--text` required but not provided           |
| MISSING_STATUS    | `--status` required but not provided         |
| INVALID_STATUS    | Status value not in the allowed list         |
| MISSING_DATE      | Neither `--days` nor `--date` provided       |
| INVALID_DAYS      | `--days` is not an integer >= 7              |
| INVALID_DATE      | `--date` is not a valid date string          |
| DATE_TOO_SOON     | `--date` is less than 7 days from today      |
| COMMAND_ERROR     | Generic command execution error              |
| FATAL             | Unexpected top-level error                   |
