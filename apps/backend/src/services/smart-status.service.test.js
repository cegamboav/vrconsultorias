import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FollowUpReason, LeadStatus } from "@crm/database";
import {
  SMART_FOLLOW_UP_DEFAULTS,
  buildSmartStatusAuditDescription,
  buildSmartStatusDisambiguationReply,
  buildSmartStatusSuccessReply,
  buildSmartStatusTimelineSummary,
  extractLeadNameFromCommercialMessage,
  inferNoInvestmentReason,
  normalizeSmartStatusPayload,
  resolveSmartFollowUpDays,
  resolveSmartFollowUpReason,
  resolveSmartStatusClarification,
  resolveSmartStatusLeadSearchQuery,
  resolveSmartStatusLeadTarget,
  validateSmartStatusPayload
} from "../services/smart-status.service.js";
import { rankLeadNameMatch } from "../services/leads.service.js";

const MARIELOS_LEAD = {
  id: "lead-marielos-1",
  leadNumber: 42,
  fullName: "Marielos Castro",
  phone: "88881111",
  status: "CONTACTED"
};

function buildMarielosSearchStub() {
  const queries = [];
  return {
    queries,
    searchLeadsByNameQuery: async ({ query }) => {
      queries.push(query);
      if (query === "Marielos Castro") {
        return [MARIELOS_LEAD];
      }
      return [];
    },
    getLeadById: async (id) => ({
      ...MARIELOS_LEAD,
      id: id ?? MARIELOS_LEAD.id
    })
  };
}

describe("SMART_STATUS_UPDATE — normalización comercial", () => {
  it("caso 1: interesado pero necesita pensarlo", () => {
    const payload = normalizeSmartStatusPayload({
      action: "SMART_STATUS_UPDATE",
      leadName: "Pedro",
      targetStatus: "FOLLOW_UP",
      followUpReason: "THINKING",
      suggestedDays: 15
    });

    assert.equal(payload.targetStatus, LeadStatus.FOLLOW_UP);
    assert.equal(payload.followUpReason, "THINKING");
    assert.equal(payload.suggestedDays, 15);
    assert.equal(resolveSmartFollowUpReason(payload), FollowUpReason.THINKING);
    assert.equal(resolveSmartFollowUpDays(payload), 15);
    assert.equal(validateSmartStatusPayload(payload), null);
  });

  it("caso 2: no tiene dinero", () => {
    const payload = normalizeSmartStatusPayload({
      leadName: "Pedro",
      targetStatus: "FOLLOW_UP",
      followUpReason: "NO_MONEY",
      suggestedDays: 30
    });

    assert.equal(resolveSmartFollowUpReason(payload), FollowUpReason.NO_MONEY);
    assert.equal(resolveSmartFollowUpDays(payload), 30);
    assert.match(
      buildSmartStatusTimelineSummary({
        targetStatus: LeadStatus.FOLLOW_UP,
        followUpReason: FollowUpReason.NO_MONEY
      }),
      /liquidez/i
    );
  });

  it("caso 3: llamar más adelante", () => {
    const payload = normalizeSmartStatusPayload({
      leadName: "Pedro",
      targetStatus: "FOLLOW_UP",
      followUpReason: "CALL_LATER",
      suggestedDays: 7
    });

    assert.equal(resolveSmartFollowUpReason(payload), FollowUpReason.CALL_LATER);
    assert.equal(resolveSmartFollowUpDays(payload), SMART_FOLLOW_UP_DEFAULTS.CALL_LATER.suggestedDays);
  });

  it("caso 4: cliente ocupado", () => {
    const payload = normalizeSmartStatusPayload({
      leadName: "Pedro",
      targetStatus: "FOLLOW_UP",
      followUpReason: "BUSY",
      suggestedDays: 7
    });

    assert.equal(resolveSmartFollowUpReason(payload), FollowUpReason.BUSY);
    assert.equal(resolveSmartFollowUpDays(payload), 7);
  });

  it("caso 5: venta concretada", () => {
    const payload = normalizeSmartStatusPayload({
      leadName: "Pedro",
      targetStatus: "CLOSED_SUCCESS"
    });

    assert.equal(payload.targetStatus, LeadStatus.CLOSED_SUCCESS);
    assert.equal(
      buildSmartStatusTimelineSummary({ targetStatus: LeadStatus.CLOSED_SUCCESS }),
      "Lead marcado como concretado."
    );
    assert.match(
      buildSmartStatusSuccessReply({
        fullName: "María",
        targetStatus: LeadStatus.CLOSED_SUCCESS
      }),
      /concretado/i
    );
  });

  it("caso 6: lead perdido", () => {
    const payload = normalizeSmartStatusPayload({
      leadName: "Pedro",
      targetStatus: "CLOSED_LOST"
    });

    assert.equal(payload.targetStatus, LeadStatus.CLOSED_LOST);
    assert.equal(
      inferNoInvestmentReason(payload, "Pedro no está interesado"),
      "Pedro no está interesado"
    );
    assert.equal(
      buildSmartStatusTimelineSummary({ targetStatus: LeadStatus.CLOSED_LOST }),
      "Lead marcado como no concretado."
    );
  });

  it("caso 7: reprogramación requiere clarificación", () => {
    const payload = normalizeSmartStatusPayload({
      leadName: "Pedro",
      targetStatus: "SCHEDULED",
      requiresClarification: true
    });

    assert.equal(
      resolveSmartStatusClarification(payload),
      "¿Para qué fecha deseas reprogramar a Pedro?"
    );
  });
});

describe("SMART_STATUS_UPDATE — mensajes operativos", () => {
  it("auditoría para seguimiento THINKING", () => {
    const text = buildSmartStatusAuditDescription({
      leadNumber: 12,
      fullName: "Carlos",
      targetStatus: LeadStatus.FOLLOW_UP,
      followUpReason: FollowUpReason.THINKING,
      days: 15
    });
    assert.match(text, /Carlos/);
    assert.match(text, /15 días/);
  });

  it("desambiguación de múltiples leads", () => {
    assert.equal(
      buildSmartStatusDisambiguationReply("Pedro"),
      "Encontré varios leads llamados Pedro. ¿Cuál deseas actualizar?"
    );
  });

  it("defaults de días cuando suggestedDays falta", () => {
    const payload = normalizeSmartStatusPayload({
      targetStatus: "FOLLOW_UP",
      followUpReason: "NO_MONEY"
    });
    assert.equal(resolveSmartFollowUpDays(payload), 30);
  });
});

describe("SMART_STATUS_UPDATE — extracción y query de búsqueda", () => {
  const marielosCases = [
    {
      message: "Marielos Castro anda de viaje",
      leadName: "Marielos Castro",
      expectedQuery: "Marielos Castro",
      followUpReason: "BUSY"
    },
    {
      message: "Marielos Castro no tiene dinero",
      leadName: "Marielos Castro",
      expectedQuery: "Marielos Castro",
      followUpReason: "NO_MONEY"
    },
    {
      message: "Marielos Castro quiere pensarlo un poco más",
      leadName: "Marielos Castro",
      expectedQuery: "Marielos Castro",
      followUpReason: "THINKING"
    },
    {
      message: "Marielos Castro ya firmó",
      leadName: "Marielos Castro",
      expectedQuery: "Marielos Castro",
      targetStatus: "CLOSED_SUCCESS"
    }
  ];

  for (const { message, leadName, expectedQuery } of marielosCases) {
    it(`query normalizado: "${message}" → "${expectedQuery}"`, () => {
      assert.equal(extractLeadNameFromCommercialMessage(message), expectedQuery);
      assert.equal(
        resolveSmartStatusLeadSearchQuery({
          userMessage: message,
          interpretation: { leadName }
        }),
        expectedQuery
      );
      assert.notEqual(
        resolveSmartStatusLeadSearchQuery({
          userMessage: message,
          interpretation: { leadName }
        }),
        message
      );
    });
  }

  it("Marielos Castro anda de viaje: leadName correcto aunque extracción falle sin IA", () => {
    const message = "Marielos Castro anda de viaje";
    assert.equal(
      resolveSmartStatusLeadSearchQuery({
        userMessage: message,
        interpretation: { leadName: "Marielos Castro" }
      }),
      "Marielos Castro"
    );
  });

  it("prioriza nombre del mensaje si la IA alucina otro distinto", () => {
    assert.equal(
      resolveSmartStatusLeadSearchQuery({
        userMessage: "Pedro López no tiene dinero",
        interpretation: { leadName: "Carlos Gamboa" }
      }),
      "Pedro López"
    );
  });

  it("usa leadName de la IA si el mensaje no trae nombre claro", () => {
    assert.equal(
      resolveSmartStatusLeadSearchQuery({
        userMessage: "quiere pensarlo un poco más",
        interpretation: { leadName: "Marielos Castro" }
      }),
      "Marielos Castro"
    );
  });

  it("rankLeadNameMatch prefiere coincidencia exacta", () => {
    assert.ok(
      rankLeadNameMatch("Marielos Castro", "Marielos Castro") <
        rankLeadNameMatch("Carlos Gamboa", "Marielos Castro")
    );
  });
});

describe("SMART_STATUS_UPDATE — resolución efectiva del lead", () => {
  for (const {
    message,
    leadName,
    followUpReason,
    targetStatus = "FOLLOW_UP",
    suggestedDays
  } of [
    {
      message: "Marielos Castro anda de viaje",
      leadName: "Marielos Castro",
      followUpReason: "BUSY",
      suggestedDays: 7
    },
    {
      message: "Marielos Castro no tiene dinero",
      leadName: "Marielos Castro",
      followUpReason: "NO_MONEY",
      suggestedDays: 30
    },
    {
      message: "Marielos Castro quiere pensarlo un poco más",
      leadName: "Marielos Castro",
      followUpReason: "THINKING",
      suggestedDays: 15
    },
    {
      message: "Marielos Castro ya firmó",
      leadName: "Marielos Castro",
      targetStatus: "CLOSED_SUCCESS"
    }
  ]) {
    it(`resuelve lead para: "${message}"`, async () => {
      const stub = buildMarielosSearchStub();
      const interpretation = {
        action: "SMART_STATUS_UPDATE",
        leadName,
        targetStatus,
        followUpReason: followUpReason ?? null,
        suggestedDays: suggestedDays ?? null
      };

      const payload = normalizeSmartStatusPayload(interpretation);
      assert.equal(payload.leadName, leadName);
      if (followUpReason) {
        assert.equal(resolveSmartFollowUpReason(payload), FollowUpReason[followUpReason]);
      }

      const query = resolveSmartStatusLeadSearchQuery({
        userMessage: message,
        interpretation
      });
      assert.equal(query, "Marielos Castro");
      assert.notEqual(query, message);

      const result = await resolveSmartStatusLeadTarget({
        userMessage: message,
        interpretation,
        getLeadById: stub.getLeadById,
        searchLeadsByNameQuery: stub.searchLeadsByNameQuery,
        rankLeadNameMatch
      });

      assert.equal(stub.queries.length, 1);
      assert.equal(stub.queries[0], "Marielos Castro");
      assert.equal(result.resolvedQuery, "Marielos Castro");
      assert.equal(result.lead.fullName, "Marielos Castro");
      assert.equal(result.ambiguous, false);
    });
  }

  it("corrige leadName mal normalizado por la IA (mensaje completo)", async () => {
    const stub = buildMarielosSearchStub();
    const result = await resolveSmartStatusLeadTarget({
      userMessage: "Marielos Castro anda de viaje",
      interpretation: { leadName: "Marielos Castro anda de viaje" },
      getLeadById: stub.getLeadById,
      searchLeadsByNameQuery: stub.searchLeadsByNameQuery,
      rankLeadNameMatch
    });

    assert.equal(stub.queries[0], "Marielos Castro");
    assert.equal(result.lead.fullName, "Marielos Castro");
    assert.equal(result.resolvedQuery, "Marielos Castro");
  });
});
