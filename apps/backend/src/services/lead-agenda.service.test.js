import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FollowUpReason, LeadStatus } from "@crm/database";
import {
  buildActionableLeadsSummaryText,
  buildUpcomingFollowupsSummaryText,
  compareActionableLeads,
  resolveUpcomingFollowupsRange
} from "./lead-agenda.service.js";

describe("GET_ACTIONABLE_LEADS — formato y orden", () => {
  it("resumen incluye motivo y próxima acción", () => {
    const text = buildActionableLeadsSummaryText([
      {
        fullName: "Marielos Perez",
        followUpReasonLabel: "No tiene liquidez",
        nextActionUrgencyLabel: "Hoy"
      },
      {
        fullName: "Keylin Perez",
        followUpReasonLabel: "Lo está pensando",
        nextActionUrgencyLabel: "Hoy"
      }
    ]);

    assert.match(text, /Tienes 2 acciones pendientes/);
    assert.match(text, /Marielos Perez/);
    assert.match(text, /Motivo: No tiene liquidez/);
    assert.match(text, /Próxima acción: Hoy/);
    assert.match(text, /Keylin Perez/);
  });

  it("sin items responde vacío amigable", () => {
    const text = buildActionableLeadsSummaryText([]);
    assert.match(text, /No tienes acciones pendientes/);
  });

  it("ordena por fecha, followUpCount y lastActivityAt", () => {
    const older = new Date("2026-06-01");
    const newer = new Date("2026-06-03");

    const leads = [
      {
        nextActionDate: newer,
        followUpCount: 1,
        lastActivityAt: new Date("2026-06-01")
      },
      {
        nextActionDate: older,
        followUpCount: 3,
        lastActivityAt: new Date("2026-05-20")
      },
      {
        nextActionDate: older,
        followUpCount: 1,
        lastActivityAt: new Date("2026-06-02")
      }
    ];

    const sorted = [...leads].sort(compareActionableLeads);
    assert.equal(sorted[0].nextActionDate, older);
    assert.equal(sorted[0].followUpCount, 3);
    assert.equal(sorted[1].followUpCount, 1);
    assert.equal(sorted[2].nextActionDate, newer);
  });
});

describe("GET_UPCOMING_FOLLOWUPS — formato y rango", () => {
  it("agrupa por fecha con viñetas", () => {
    const text = buildUpcomingFollowupsSummaryText([
      { fullName: "Marielos Perez", groupDateLabel: "30 jun" },
      { fullName: "Luis Vargas", groupDateLabel: "5 jul" }
    ]);

    assert.match(text, /Próximos seguimientos/);
    assert.match(text, /30 jun\n- Marielos Perez/);
    assert.match(text, /5 jul\n- Luis Vargas/);
  });

  it("mañana → rango de un solo día", () => {
    const range = resolveUpcomingFollowupsRange("¿Qué tengo mañana?");
    assert.equal(range.scope, "TOMORROW");
    const diffMs = range.rangeEndExclusive.getTime() - range.rangeStart.getTime();
    assert.equal(diffMs, 86400000);
  });

  it("esta semana → próximos 7 días por defecto", () => {
    const range = resolveUpcomingFollowupsRange("¿Qué seguimientos vencen esta semana?");
    assert.equal(range.scope, "NEXT_7_DAYS");
  });

  it("próximos 7 días explícito", () => {
    const range = resolveUpcomingFollowupsRange(
      "¿Qué tengo programado para los próximos 7 días?",
      { daysAhead: 7 }
    );
    assert.equal(range.scope, "NEXT_7_DAYS");
  });
});

describe("GET_ACTIONABLE_LEADS — intenciones", () => {
  it("¿Qué debo hacer hoy? → GET_ACTIONABLE_LEADS", () => {
    assert.equal(
      { action: "GET_ACTIONABLE_LEADS" }.action,
      "GET_ACTIONABLE_LEADS"
    );
  });
});
