import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FollowUpReason, LeadStatus } from "@crm/database";
import { buildInterpretationFromAssistantContext } from "./assistant-context-resolver.service.js";
import {
  buildSuggestNextActionDisambiguationContext,
  PENDING_ACTIONS
} from "./assistant-conversation-context.service.js";
import {
  buildSuggestRecommendation,
  buildSuggestRationale,
  buildSuggestNextActionDisambiguationReply,
  formatSuggestNextActionText
} from "./lead-suggest-action.service.js";

function lead(overrides = {}) {
  return {
    status: LeadStatus.FOLLOW_UP,
    followUpReason: FollowUpReason.BUSY,
    followUpCount: 1,
    nextActionDate: new Date("2026-06-07T12:00:00"),
    lastActivityAt: new Date("2026-06-01T12:00:00"),
    createdAt: new Date("2026-05-20T12:00:00"),
    ...overrides
  };
}

describe("SUGGEST_NEXT_ACTION — reglas base", () => {
  it("FOLLOW_UP + BUSY con fecha próxima", () => {
    const text = buildSuggestRecommendation(
      lead({ nextActionDate: new Date(Date.now() + 86400000 * 2) })
    );
    assert.match(text, /fecha programada/i);
  });

  it("FOLLOW_UP + NO_MONEY", () => {
    const text = buildSuggestRecommendation(
      lead({ followUpReason: FollowUpReason.NO_MONEY })
    );
    assert.match(text, /situación económica/i);
  });

  it("FOLLOW_UP + THINKING", () => {
    const text = buildSuggestRecommendation(
      lead({ followUpReason: FollowUpReason.THINKING })
    );
    assert.match(text, /dudas/i);
  });

  it("CONTACTED", () => {
    const text = buildSuggestRecommendation(lead({ status: LeadStatus.CONTACTED }));
    assert.match(text, /seguimiento para confirmar interés/i);
  });

  it("NEW", () => {
    const text = buildSuggestRecommendation(lead({ status: LeadStatus.NEW }));
    assert.match(text, /primer contacto comercial/i);
  });

  it("SCHEDULED", () => {
    const text = buildSuggestRecommendation(lead({ status: LeadStatus.SCHEDULED }));
    assert.match(text, /Confirmar asistencia/i);
  });

  it("CLOSED_SUCCESS", () => {
    const text = buildSuggestRecommendation(lead({ status: LeadStatus.CLOSED_SUCCESS }));
    assert.match(text, /referidos|venta cruzada/i);
  });

  it("CLOSED_LOST", () => {
    const text = buildSuggestRecommendation(lead({ status: LeadStatus.CLOSED_LOST }));
    assert.match(text, /reactivación futura/i);
  });
});

describe("SUGGEST_NEXT_ACTION — respuesta enriquecida", () => {
  it("formato incluye estado, motivo, recomendación y justificación", () => {
    const text = formatSuggestNextActionText({
      fullName: "Keylin Perez",
      statusLabel: "Seguimiento",
      followUpReasonLabel: "Ocupado",
      nextActionDateLabel: "7 jun 2026",
      recommendation:
        "Contactarlo para validar si ya dispone de tiempo para retomar la conversación.",
      rationale: "La próxima acción está programada en 3 día(s)."
    });

    assert.match(text, /Keylin Perez/);
    assert.match(text, /Estado:\nSeguimiento/);
    assert.match(text, /Motivo:\nOcupado/);
    assert.match(text, /Próxima acción:\n7 jun 2026/);
    assert.match(text, /Recomendación:/);
    assert.match(text, /Justificación:/);
  });

  it("justificación usa notas y seguimientos", () => {
    const rationale = buildSuggestRationale({
      lead: lead({ followUpCount: 3, nextActionDate: new Date(Date.now() - 86400000) }),
      notes: [{ text: "Mostró interés en contabilidad." }],
      activities: [{ type: "NOTE_ADDED" }]
    });
    assert.match(rationale, /seguimiento/i);
    assert.match(rationale, /nota/i);
  });
});

describe("SUGGEST_NEXT_ACTION — desambiguación Marielos", () => {
  const candidates = [
    { id: "lead-mp", leadNumber: 4, fullName: "Marielos Perez" },
    { id: "lead-mc", leadNumber: 6, fullName: "Marielos Castro" }
  ];

  it("mensaje de varias coincidencias", () => {
    const reply = buildSuggestNextActionDisambiguationReply(candidates);
    assert.match(reply, /1\. Marielos Perez/);
    assert.match(reply, /¿De cuál deseas la recomendación\?/);
  });

  it("contexto pendingDisambiguation", () => {
    const ctx = buildSuggestNextActionDisambiguationContext({
      leadName: "Marielos",
      candidates
    });
    assert.equal(ctx.pendingAction, PENDING_ACTIONS.SUGGEST_NEXT_ACTION);
  });

  it("turno 2: Marielos Perez → SUGGEST_NEXT_ACTION", () => {
    const interpretation = buildInterpretationFromAssistantContext(
      buildSuggestNextActionDisambiguationContext({ leadName: "Marielos", candidates }),
      "Marielos Perez"
    );
    assert.equal(interpretation.action, "SUGGEST_NEXT_ACTION");
    assert.equal(interpretation.leadId, "lead-mp");
  });
});
