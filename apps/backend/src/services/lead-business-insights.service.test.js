import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildBusinessInsightsFromData,
  formatBusinessInsightsText,
  resolveInsightsPeriod,
  sortBusinessInsights
} from "./lead-business-insights.service.js";

describe("GET_BUSINESS_INSIGHTS — periodo", () => {
  it("últimos 30 días incluye hoy", () => {
    const period = resolveInsightsPeriod(new Date("2026-06-04T12:00:00"));
    assert.equal(period.days, 30);
    assert.equal(period.periodEndLabel, "2026-06-04");
    assert.equal(period.periodStartLabel, "2026-05-06");
  });
});

describe("GET_BUSINESS_INSIGHTS — reglas", () => {
  it("genera insights de servicio, seguimiento, pipeline y cierre", () => {
    const insights = buildBusinessInsightsFromData({
      topServiceConcentration: {
        serviceName: "Charlas",
        share: 0.75,
        count: 6,
        totalCreated: 8
      },
      dominantFollowUpReason: {
        reason: "NO_MONEY",
        label: "No tiene liquidez",
        share: 0.6,
        count: 3,
        total: 5
      },
      openLeadsTotal: 4,
      followUpOpenCount: 2,
      overdueFollowups: 0,
      leadsCreatedInPeriod: 8,
      leadsClosedInPeriod: 3,
      leadsClosedSuccessInPeriod: 2,
      leadsClosedLostInPeriod: 1,
      inactiveOpenLeads: 0
    });

    assert.ok(insights.some((i) => /Charlas/.test(i.message)));
    assert.ok(insights.some((i) => /liquidez/i.test(i.message)));
    assert.ok(insights.some((i) => /cartera activa/i.test(i.message)));
    assert.ok(insights.some((i) => /favorable/i.test(i.message)));
  });

  it("ordena WARNING antes que POSITIVE e INFO", () => {
    const sorted = sortBusinessInsights([
      { severity: "INFO", message: "info" },
      { severity: "WARNING", message: "warn" },
      { severity: "POSITIVE", message: "pos" }
    ]);
    assert.equal(sorted[0].severity, "WARNING");
    assert.equal(sorted[1].severity, "POSITIVE");
    assert.equal(sorted[2].severity, "INFO");
  });

  it("detecta seguimientos atrasados y generación baja", () => {
    const insights = buildBusinessInsightsFromData({
      topServiceConcentration: null,
      dominantFollowUpReason: null,
      openLeadsTotal: 10,
      followUpOpenCount: 5,
      overdueFollowups: 3,
      leadsCreatedInPeriod: 1,
      leadsClosedInPeriod: 4,
      leadsClosedSuccessInPeriod: 1,
      leadsClosedLostInPeriod: 3,
      inactiveOpenLeads: 2,
      topLostReason: "No tiene presupuesto"
    });

    assert.ok(insights.some((i) => /atrasados/i.test(i.message)));
    assert.ok(insights.some((i) => /generación de nuevos leads/i.test(i.message)));
    assert.ok(insights.some((i) => /sin actividad reciente/i.test(i.message)));
    assert.ok(insights.some((i) => /perdidos/i.test(i.message)));
  });

  it("formato numerado", () => {
    const text = formatBusinessInsightsText([
      { message: "La mayoría de los seguimientos están relacionados con falta de liquidez." },
      { message: "La tasa de cierre reciente es favorable." }
    ]);
    assert.match(text, /Insights del negocio/);
    assert.match(text, /1\. La mayoría/);
    assert.match(text, /2\. La tasa/);
  });
});

describe("GET_BUSINESS_INSIGHTS — intenciones", () => {
  it("acción esperada", () => {
    assert.equal(
      { action: "GET_BUSINESS_INSIGHTS" }.action,
      "GET_BUSINESS_INSIGHTS"
    );
  });
});
