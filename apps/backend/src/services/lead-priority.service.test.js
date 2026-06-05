import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LeadStatus } from "@crm/database";
import {
  buildPriorityLeadsSummaryText,
  buildPriorityReason,
  comparePriorityLeads,
  computePriorityScore,
  resolvePriorityLevel
} from "./lead-priority.service.js";

function lead(overrides = {}) {
  return {
    status: LeadStatus.NEW,
    followUpCount: 0,
    nextActionDate: null,
    lastActivityAt: null,
    ...overrides
  };
}

describe("GET_PRIORITY_LEADS — scoring", () => {
  it("FOLLOW_UP vencido suma base + fecha + seguimientos", () => {
    const score = computePriorityScore(
      lead({
        status: LeadStatus.FOLLOW_UP,
        followUpCount: 2,
        nextActionDate: new Date(Date.now() - 86400000 * 3)
      })
    );
    assert.equal(score, 50 + 40 + 10);
  });

  it("SCHEDULED hoy incluye bonus de actividad reciente", () => {
    const score = computePriorityScore(
      lead({
        status: LeadStatus.SCHEDULED,
        nextActionDate: startOfToday(),
        lastActivityAt: new Date()
      })
    );
    assert.equal(score, 40 + 30 + 10);
  });

  it("NEW sin fecha tiene score bajo", () => {
    const score = computePriorityScore(lead({ status: LeadStatus.NEW }));
    assert.equal(score, 10);
  });

  it("niveles Alta, Media y Baja", () => {
    assert.equal(resolvePriorityLevel(95).level, "ALTA");
    assert.equal(resolvePriorityLevel(90).level, "ALTA");
    assert.equal(resolvePriorityLevel(75).level, "MEDIA");
    assert.equal(resolvePriorityLevel(60).level, "MEDIA");
    assert.equal(resolvePriorityLevel(59).level, "BAJA");
  });
});

describe("GET_PRIORITY_LEADS — motivo y resumen", () => {
  it("motivo para seguimiento programado", () => {
    const reason = buildPriorityReason(
      lead({
        status: LeadStatus.FOLLOW_UP,
        nextActionDate: new Date("2026-06-07T12:00:00")
      })
    );
    assert.match(reason, /Seguimiento programado para/i);
  });

  it("motivo genérico en seguimiento sin fecha", () => {
    const reason = buildPriorityReason(lead({ status: LeadStatus.FOLLOW_UP }));
    assert.equal(reason, "Lead en seguimiento.");
  });

  it("resumen numerado con prioridad y estado", () => {
    const text = buildPriorityLeadsSummaryText([
      {
        fullName: "Keylin Perez",
        priorityLevelLabel: "Alta",
        priorityReason: "Seguimiento programado para 7 jun.",
        statusLabel: "Seguimiento"
      },
      {
        fullName: "Marielos Perez",
        priorityLevelLabel: "Media",
        priorityReason: "Lead en seguimiento.",
        statusLabel: "Seguimiento"
      }
    ]);

    assert.match(text, /Leads recomendados para atender/);
    assert.match(text, /1\. Keylin Perez/);
    assert.match(text, /Prioridad: Alta/);
    assert.match(text, /2\. Marielos Perez/);
    assert.match(text, /Prioridad: Media/);
  });

  it("respuesta vacía", () => {
    const text = buildPriorityLeadsSummaryText([]);
    assert.equal(text, "No tienes leads abiertos para priorizar.");
  });
});

describe("GET_PRIORITY_LEADS — ordenamiento", () => {
  it("ordena por score, fecha y actividad", () => {
    const items = [
      {
        priorityScore: 70,
        nextActionDate: "2026-06-10",
        lastActivityAt: "2026-06-01T00:00:00.000Z"
      },
      {
        priorityScore: 90,
        nextActionDate: "2026-06-05",
        lastActivityAt: "2026-06-02T00:00:00.000Z"
      },
      {
        priorityScore: 70,
        nextActionDate: "2026-06-03",
        lastActivityAt: "2026-06-04T00:00:00.000Z"
      }
    ];

    const sorted = [...items].sort(comparePriorityLeads);
    assert.equal(sorted[0].priorityScore, 90);
    assert.equal(sorted[1].nextActionDate, "2026-06-03");
    assert.equal(sorted[2].nextActionDate, "2026-06-10");
  });
});

function startOfToday() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}
