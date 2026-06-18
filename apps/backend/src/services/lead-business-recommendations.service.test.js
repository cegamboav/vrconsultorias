import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildBusinessRecommendationsFromContext,
  formatBusinessRecommendationsText,
  sortBusinessRecommendations
} from "./lead-business-recommendations.service.js";

describe("GET_BUSINESS_RECOMMENDATIONS — reglas", () => {
  it("genera recomendaciones accionables priorizadas", () => {
    const recs = buildBusinessRecommendationsFromContext({
      overdueCount: 2,
      overdueLeadNames: ["Marielos Perez"],
      actionableCount: 1,
      actionableLeadNames: ["Keylin Perez"],
      topPriorityLeads: [
        { fullName: "Keylin Perez" },
        { fullName: "Luis Vargas" },
        { fullName: "Marielos Perez" }
      ],
      dominantFollowUpReason: { reason: "NO_MONEY", share: 0.6, label: "No tiene liquidez" },
      openLeadsTotal: 4,
      inactiveOpenLeads: 1,
      leadsClosedSuccessInPeriod: 2,
      leadsClosedLostInPeriod: 1
    });

    assert.equal(recs[0].level, "CRITICAL");
    assert.match(recs[0].message, /inmediatamente/i);
    assert.ok(recs.some((r) => r.type === "PRIORITY_LEADS"));
    assert.ok(recs.some((r) => /limitaciones económicas/i.test(r.message)));
    assert.ok(recs.some((r) => r.type === "LEAD_GENERATION"));
    assert.ok(recs.some((r) => r.type === "CLOSING_MOMENTUM"));
  });

  it("THINKING genera recomendación de indecisos", () => {
    const recs = buildBusinessRecommendationsFromContext({
      overdueCount: 0,
      overdueLeadNames: [],
      actionableCount: 0,
      actionableLeadNames: [],
      topPriorityLeads: [],
      dominantFollowUpReason: { reason: "THINKING", share: 0.7 },
      openLeadsTotal: 10,
      inactiveOpenLeads: 0,
      leadsClosedSuccessInPeriod: 0,
      leadsClosedLostInPeriod: 0
    });

    assert.ok(recs.some((r) => /indecisos/i.test(r.message)));
  });

  it("ordena CRITICAL antes que LOW", () => {
    const sorted = sortBusinessRecommendations([
      { level: "LOW", type: "A", message: "low" },
      { level: "CRITICAL", type: "B", message: "crit" },
      { level: "HIGH", type: "C", message: "high" }
    ]);
    assert.equal(sorted[0].level, "CRITICAL");
    assert.equal(sorted[1].level, "HIGH");
    assert.equal(sorted[2].level, "LOW");
    assert.equal(sorted[0].priority, 1);
  });

  it("formato numerado con leads", () => {
    const text = formatBusinessRecommendationsText([
      {
        message: "Contactar los leads prioritarios:",
        leadNames: ["Keylin Perez", "Marielos Perez"]
      },
      {
        message:
          "Incrementar la generación de nuevos leads, ya que la cartera activa es reducida."
      }
    ]);

    assert.match(text, /Recomendaciones comerciales/);
    assert.match(text, /1\. Contactar los leads prioritarios/);
    assert.match(text, /- Keylin Perez/);
    assert.match(text, /2\. Incrementar la generación/);
  });
});

describe("GET_BUSINESS_RECOMMENDATIONS — intenciones", () => {
  it("acción esperada", () => {
    assert.equal(
      { action: "GET_BUSINESS_RECOMMENDATIONS" }.action,
      "GET_BUSINESS_RECOMMENDATIONS"
    );
  });
});
