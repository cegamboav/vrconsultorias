import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LeadStatus } from "@crm/database";
import {
  buildInterpretationFromAssistantContext,
  inferPersistContextFromClarify
} from "../services/assistant-context-resolver.service.js";
import { PENDING_ACTIONS } from "../services/assistant-conversation-context.service.js";
import { getAllowedNextStatuses } from "../services/leads.service.js";
import { buildAllowedTransitionsReply } from "../services/assistant-context-resolver.service.js";

/**
 * Simula el flujo multi-turno sin BD:
 * turno 1 → guardar contexto; turno 2 → interpretación desde contexto.
 */
describe("Integración conversacional — flujo Luis Vargas", () => {
  it("turno 1 CLARIFY + turno 2 Contactado → MOVE_LEAD_STATUS", () => {
    const turn1Persist = inferPersistContextFromClarify({
      leadName: "Luis Vargas",
      clarification: "¿A qué estado deseas cambiar a Luis Vargas?"
    });

    assert.equal(turn1Persist.pendingAction, PENDING_ACTIONS.MOVE_LEAD_STATUS);

    const turn2 = buildInterpretationFromAssistantContext(
      {
        pendingAction: turn1Persist.pendingAction,
        leadId: "lead-luis-1",
        leadName: turn1Persist.leadName,
        metadata: null
      },
      "Contactado"
    );

    assert.equal(turn2.action, "MOVE_LEAD_STATUS");
    assert.equal(turn2.status, LeadStatus.CONTACTED);
    assert.equal(turn2.leadName, "Luis Vargas");
  });

  it("GET_ALLOWED_TRANSITIONS + respuesta corta coherente con reglas CRM", () => {
    const allowed = getAllowedNextStatuses(LeadStatus.NEW);
    assert.deepEqual(allowed, [LeadStatus.CONTACTED]);

    const reply = buildAllowedTransitionsReply({
      fullName: "Luis Vargas",
      currentStatus: LeadStatus.NEW,
      allowedStatuses: allowed
    });

    assert.match(reply, /Contactado/);

    const followUp = buildInterpretationFromAssistantContext(
      {
        pendingAction: PENDING_ACTIONS.MOVE_LEAD_STATUS,
        leadId: "lead-luis-1",
        leadName: "Luis Vargas"
      },
      "Contactado"
    );

    assert.equal(followUp.status, LeadStatus.CONTACTED);
    assert.ok(allowed.includes(followUp.status));
  });
});
