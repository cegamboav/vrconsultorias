import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FollowUpReason, LeadStatus } from "@crm/database";
import {
  buildAddNoteClarification,
  buildAllowedTransitionsReply,
  buildInterpretationFromAssistantContext,
  buildMoveLeadStatusClarification,
  inferPersistContextFromClarify,
  isStandaloneSpanishStatusMessage,
  NO_PENDING_CONTEXT_REPLY,
  parseSpanishDatePhrase,
  parseSpanishStatusLabel,
  shouldClearContextAfterAction
} from "../services/assistant-context-resolver.service.js";
import { PENDING_ACTIONS } from "../services/assistant-conversation-context.service.js";

describe("Assistant context resolver — estados en español", () => {
  for (const [label, status] of [
    ["Nuevo", LeadStatus.NEW],
    ["Contactado", LeadStatus.CONTACTED],
    ["Agendado", LeadStatus.SCHEDULED],
    ["Seguimiento", LeadStatus.FOLLOW_UP],
    ["Concretado", LeadStatus.CLOSED_SUCCESS],
    ["No concretado", LeadStatus.CLOSED_LOST]
  ]) {
    it(`parsea "${label}" → ${status}`, () => {
      assert.equal(parseSpanishStatusLabel(label), status);
      assert.equal(isStandaloneSpanishStatusMessage(label), true);
    });
  }

  it("sin contexto, respuesta solo de estado", () => {
    assert.equal(NO_PENDING_CONTEXT_REPLY.includes("acción pendiente"), true);
  });
});

describe("Assistant context resolver — CASO 1 MOVE_LEAD_STATUS", () => {
  const context = {
    pendingAction: PENDING_ACTIONS.MOVE_LEAD_STATUS,
    leadId: "lead-luis",
    leadName: "Luis Vargas",
    metadata: null
  };

  it('"Contactado" completa el cambio de estado pendiente', () => {
    const interpretation = buildInterpretationFromAssistantContext(context, "Contactado");
    assert.equal(interpretation.action, "MOVE_LEAD_STATUS");
    assert.equal(interpretation.status, LeadStatus.CONTACTED);
    assert.equal(interpretation.leadName, "Luis Vargas");
    assert.equal(interpretation.leadId, "lead-luis");
  });

  it("CLARIFY del intérprete guarda contexto de estado", () => {
    const persist = inferPersistContextFromClarify({
      leadName: "Luis Vargas",
      clarification: buildMoveLeadStatusClarification("Luis Vargas")
    });
    assert.equal(persist.pendingAction, PENDING_ACTIONS.MOVE_LEAD_STATUS);
    assert.equal(persist.leadName, "Luis Vargas");
  });

  it("GET_ALLOWED_TRANSITIONS reply incluye estados permitidos", () => {
    const reply = buildAllowedTransitionsReply({
      fullName: "Luis Vargas",
      currentStatus: LeadStatus.NEW,
      allowedStatuses: [LeadStatus.CONTACTED]
    });
    assert.match(reply, /Luis Vargas/);
    assert.match(reply, /Nuevo/);
    assert.match(reply, /Contactado/);
  });
});

describe("Assistant context resolver — CASO 2 reprogramación", () => {
  const context = {
    pendingAction: PENDING_ACTIONS.RESCHEDULE,
    leadId: null,
    leadName: "Luis",
    metadata: { targetStatus: LeadStatus.SCHEDULED }
  };

  it('"15 de junio" → RESCHEDULE_APPOINTMENT', () => {
    const ymd = parseSpanishDatePhrase("15 de junio");
    assert.ok(ymd);
    assert.match(ymd, /-06-15$/);

    const interpretation = buildInterpretationFromAssistantContext(context, "15 de junio");
    assert.equal(interpretation.action, "RESCHEDULE_APPOINTMENT");
    assert.equal(interpretation.nextActionDate, ymd);
    assert.equal(interpretation.leadName, "Luis");
  });

  it("CLARIFY de fecha guarda contexto RESCHEDULE", () => {
    const persist = inferPersistContextFromClarify({
      leadName: "Luis",
      clarification: "¿Para qué fecha deseas reprogramar?"
    });
    assert.equal(persist.pendingAction, PENDING_ACTIONS.RESCHEDULE);
  });
});

describe("Assistant context resolver — CASO 3 ADD_LEAD_NOTE", () => {
  const context = {
    pendingAction: PENDING_ACTIONS.ADD_LEAD_NOTE,
    leadId: "lead-luis",
    leadName: "Luis",
    metadata: null
  };

  it("texto libre completa la nota pendiente", () => {
    const interpretation = buildInterpretationFromAssistantContext(
      context,
      "Quiere revisarlo con su esposa."
    );
    assert.equal(interpretation.action, "ADD_LEAD_NOTE");
    assert.equal(interpretation.note, "Quiere revisarlo con su esposa.");
    assert.equal(interpretation.leadId, "lead-luis");
  });

  it("CLARIFY de nota guarda contexto ADD_LEAD_NOTE", () => {
    const persist = inferPersistContextFromClarify({
      leadName: "Luis",
      clarification: buildAddNoteClarification("Luis")
    });
    assert.equal(persist.pendingAction, PENDING_ACTIONS.ADD_LEAD_NOTE);
  });

  it("no confunde estado suelto con nota", () => {
    assert.equal(
      buildInterpretationFromAssistantContext(context, "Contactado"),
      null
    );
  });
});

describe("Assistant context resolver — limpieza de contexto", () => {
  it("acciones de escritura limpian contexto al completar", () => {
    assert.equal(shouldClearContextAfterAction("MOVE_LEAD_STATUS"), true);
    assert.equal(shouldClearContextAfterAction("ADD_LEAD_NOTE"), true);
    assert.equal(shouldClearContextAfterAction("GET_ALLOWED_TRANSITIONS"), false);
  });

  it("Seguimiento pendiente usa SCHEDULE_FOLLOW_UP", () => {
    const interpretation = buildInterpretationFromAssistantContext(
      {
        pendingAction: PENDING_ACTIONS.MOVE_LEAD_STATUS,
        leadName: "Luis",
        leadId: "x"
      },
      "Seguimiento"
    );
    assert.equal(interpretation.action, "SCHEDULE_FOLLOW_UP");
    assert.equal(interpretation.days, 7);
    assert.equal(interpretation.followUpReason, FollowUpReason.OTHER);
  });
});
