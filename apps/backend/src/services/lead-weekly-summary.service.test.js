import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LeadStatus } from "@crm/database";
import {
  buildWeeklyObservations,
  formatWeeklyBusinessSummaryText,
  resolveWeeklySummaryPeriod
} from "./lead-weekly-summary.service.js";

describe("GET_WEEKLY_BUSINESS_SUMMARY — periodo", () => {
  it("últimos 7 días incluye hoy", () => {
    const now = new Date("2026-06-04T15:00:00");
    const period = resolveWeeklySummaryPeriod(now);
    assert.equal(period.periodEndLabel, "2026-06-04");
    assert.equal(period.periodStartLabel, "2026-05-29");
  });
});

describe("GET_WEEKLY_BUSINESS_SUMMARY — observaciones", () => {
  it("detecta mayoría en seguimiento y servicio top", () => {
    const observations = buildWeeklyObservations({
      metrics: {
        leadsCreated: 4,
        leadsClosedSuccess: 1,
        leadsLost: 0,
        leadsSentToFollowUp: 2
      },
      activities: { notesAdded: 3, statusChanges: 2, followUpsScheduled: 2 },
      services: [{ rank: 1, serviceName: "Contabilidad", count: 4 }],
      openByStatus: {
        [LeadStatus.NEW]: 1,
        [LeadStatus.CONTACTED]: 1,
        [LeadStatus.SCHEDULED]: 0,
        [LeadStatus.FOLLOW_UP]: 6
      },
      topFollowUpReason: { reason: "NO_MONEY", label: "No tiene liquidez", count: 3 }
    });

    assert.ok(observations.some((o) => /seguimiento/i.test(o)));
    assert.ok(observations.some((o) => /liquidez/i.test(o)));
    assert.ok(observations.some((o) => /Contabilidad/i.test(o)));
  });
});

describe("GET_WEEKLY_BUSINESS_SUMMARY — formato", () => {
  it("incluye métricas, servicios, actividad, pendientes y observaciones", () => {
    const text = formatWeeklyBusinessSummaryText({
      metrics: {
        leadsCreated: 8,
        leadsClosedSuccess: 2,
        leadsLost: 1,
        leadsSentToFollowUp: 3
      },
      services: [
        { rank: 1, serviceName: "Contabilidad", count: 4 },
        { rank: 2, serviceName: "Charlas", count: 3 }
      ],
      activities: {
        notesAdded: 5,
        statusChanges: 7,
        followUpsScheduled: 3
      },
      pending: {
        overdueFollowups: 2,
        upcomingFollowups: 4
      },
      observations: ["La mayoría de los leads abiertos están en seguimiento."]
    });

    assert.match(text, /Resumen comercial semanal/);
    assert.match(text, /Leads creados: 8/);
    assert.match(text, /1\. Contabilidad \(4\)/);
    assert.match(text, /Notas agregadas: 5/);
    assert.match(text, /Seguimientos vencidos: 2/);
    assert.match(text, /Observaciones:/);
  });
});

describe("GET_WEEKLY_BUSINESS_SUMMARY — intenciones", () => {
  it("mapeo esperado resumen semanal", () => {
    assert.equal(
      { action: "GET_WEEKLY_BUSINESS_SUMMARY" }.action,
      "GET_WEEKLY_BUSINESS_SUMMARY"
    );
  });
});
