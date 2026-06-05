import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildAddLeadNoteClarification,
  buildAddLeadNoteChoiceReply,
  buildAddLeadNoteDisambiguationReply,
  buildAddLeadNoteSuccessReply,
  buildLeadNotFoundReply,
  extractLeadNoteFromMessage,
  resolveLeadCandidateFromMessage,
  resolveLeadNotePayload
} from "../services/assistant-lead-note.service.js";
import {
  buildAddLeadNoteContext,
  buildAddLeadNoteDisambiguationContext,
  PENDING_ACTIONS
} from "../services/assistant-conversation-context.service.js";
import { buildInterpretationFromAssistantContext } from "../services/assistant-context-resolver.service.js";
import {
  formatAssistantNoteDescription,
  formatLeadNotesSummaryText,
  readNoteTextFromActivity
} from "../services/lead-notes.service.js";

describe("ADD_LEAD_NOTE — extracción lenguaje natural", () => {
  it("CASO 1: Melissa con nota en el mismo mensaje", () => {
    const message = "Agrega una nota a Melissa: Quiere revisarlo con su esposo.";
    const extracted = extractLeadNoteFromMessage(message);
    assert.deepEqual(extracted, {
      leadName: "Melissa",
      note: "Quiere revisarlo con su esposo."
    });

    const payload = resolveLeadNotePayload({
      userMessage: message,
      interpretation: { leadName: "Melissa", note: "Quiere revisarlo con su esposo." }
    });
    assert.equal(payload.leadName, "Melissa");
    assert.equal(payload.note, "Quiere revisarlo con su esposo.");
  });

  it("CASO 2: Luis Vargas con dos puntos", () => {
    const message = "Agregar nota a Luis Vargas: Solicitó una propuesta formal.";
    const extracted = extractLeadNoteFromMessage(message);
    assert.equal(extracted.leadName, "Luis Vargas");
    assert.equal(extracted.note, "Solicitó una propuesta formal.");
  });

  it("CASO 3: Anota en Marielos", () => {
    const message = "Anota en Marielos: Está comparando varias opciones.";
    const extracted = extractLeadNoteFromMessage(message);
    assert.equal(extracted.leadName, "Marielos");
    assert.equal(extracted.note, "Está comparando varias opciones.");
  });

  it("sin contenido de nota → solo leadName", () => {
    const extracted = extractLeadNoteFromMessage("Agregar una nota a Melissa");
    assert.deepEqual(extracted, { leadName: "Melissa", note: null });
  });
});

describe("ADD_LEAD_NOTE — modo conversacional", () => {
  it("turno 2 completa nota pendiente", () => {
    const context = buildAddLeadNoteContext({ leadId: "lead-m", leadName: "Melissa" });
    assert.equal(context.pendingAction, PENDING_ACTIONS.ADD_LEAD_NOTE);

    const interpretation = buildInterpretationFromAssistantContext(context, "Quiere revisarlo con su esposo.");
    assert.equal(interpretation.action, "ADD_LEAD_NOTE");
    assert.equal(interpretation.leadName, "Melissa");
    assert.equal(interpretation.note, "Quiere revisarlo con su esposo.");
  });

  it("clarificación cuando falta contenido", () => {
    assert.match(buildAddLeadNoteClarification("Melissa"), /Melissa/);
  });
});

describe("ADD_LEAD_NOTE — timeline muestra contenido real", () => {
  it("description contiene NOTA y texto completo", () => {
    const description = formatAssistantNoteDescription(
      "Quiere llevar una contabilidad para 2 empresas."
    );
    assert.match(description, /^NOTA\n/);
    assert.match(description, /Quiere llevar una contabilidad para 2 empresas/);

    const text = readNoteTextFromActivity({
      description,
      metadata: { source: "assistant", note: "Quiere llevar una contabilidad para 2 empresas." }
    });
    assert.equal(text, "Quiere llevar una contabilidad para 2 empresas.");
  });

  it("lee nota legacy desde metadata", () => {
    const text = readNoteTextFromActivity({
      description: "Nota agregada por asistente.",
      metadata: { note: "Texto legacy" }
    });
    assert.equal(text, "Texto legacy");
  });
});

describe("ADD_LEAD_NOTE — desambiguación con contexto", () => {
  const candidates = [
    { id: "lead-mp", leadNumber: 10, fullName: "Marielos Perez" },
    { id: "lead-mc", leadNumber: 11, fullName: "Marielos Castro" }
  ];

  it("pregunta estilo ¿A o B?", () => {
    assert.equal(
      buildAddLeadNoteChoiceReply(candidates),
      "¿Marielos Perez o Marielos Castro?"
    );
  });

  it("guarda contexto pendingDisambiguation", () => {
    const ctx = buildAddLeadNoteDisambiguationContext({
      leadName: "Marielos",
      candidates
    });
    assert.equal(ctx.pendingAction, PENDING_ACTIONS.ADD_LEAD_NOTE);
    assert.equal(ctx.metadata.pendingDisambiguation, true);
    assert.equal(ctx.metadata.candidates.length, 2);
  });

  it("turno 2: Marielos Perez resuelve candidato y pide nota", () => {
    const disambiguationCtx = buildAddLeadNoteDisambiguationContext({
      leadName: "Marielos",
      candidates
    });

    const pick = buildInterpretationFromAssistantContext(disambiguationCtx, "Marielos Perez");
    assert.equal(pick.action, "ADD_LEAD_NOTE");
    assert.equal(pick.leadId, "lead-mp");
    assert.equal(pick.leadName, "Marielos Perez");
    assert.equal(pick.note, null);

    assert.equal(resolveLeadCandidateFromMessage("Marielos Perez", candidates).id, "lead-mp");
  });

  it("turno 3: contenido de nota tras elegir lead", () => {
    const noteCtx = buildAddLeadNoteContext({
      leadId: "lead-mp",
      leadName: "Marielos Perez"
    });

    const noteTurn = buildInterpretationFromAssistantContext(
      noteCtx,
      "Quiere llevar una contabilidad para 2 empresas."
    );
    assert.equal(noteTurn.action, "ADD_LEAD_NOTE");
    assert.equal(noteTurn.leadId, "lead-mp");
    assert.equal(noteTurn.note, "Quiere llevar una contabilidad para 2 empresas.");
  });

  it("flujo completo desambiguación + nota", () => {
    const disambiguationCtx = buildAddLeadNoteDisambiguationContext({
      leadName: "Marielos",
      candidates
    });

    const pick = buildInterpretationFromAssistantContext(disambiguationCtx, "Marielos Perez");
    assert.equal(pick.leadName, "Marielos Perez");

    const noteCtx = buildAddLeadNoteContext({
      leadId: pick.leadId,
      leadName: pick.leadName
    });
    const noteTurn = buildInterpretationFromAssistantContext(
      noteCtx,
      "Quiere llevar una contabilidad para 2 empresas."
    );

    assert.equal(noteTurn.note, "Quiere llevar una contabilidad para 2 empresas.");
    assert.equal(buildAddLeadNoteSuccessReply("Marielos Perez"), "Nota agregada a Marielos Perez.");
  });
});

describe("ADD_LEAD_NOTE — mensajes operativos", () => {
  it("respuesta de éxito", () => {
    assert.equal(buildAddLeadNoteSuccessReply("Melissa Granados"), "Nota agregada a Melissa Granados.");
  });

  it("lead no encontrado", () => {
    assert.equal(buildLeadNotFoundReply("Melissa"), "No encontré ningún lead llamado Melissa.");
  });

  it("desambiguación genérica por nombre parcial", () => {
    assert.match(buildAddLeadNoteDisambiguationReply("Marielos"), /varios leads llamados Marielos/);
  });
});

describe("GET_LEAD_NOTES — formato de respuesta", () => {
  it("lista cronológica de notas", () => {
    const summary = formatLeadNotesSummaryText({
      fullName: "Melissa Granados",
      notes: [
        { createdAtLabel: "01/05/2026", text: "Quiere revisarlo con su esposo.", authorName: "Carlos" },
        { createdAtLabel: "10/05/2026", text: "Pidió propuesta formal.", authorName: null }
      ]
    });
    assert.match(summary, /Melissa Granados/);
    assert.match(summary, /Quiere revisarlo con su esposo/);
    assert.match(summary, /Pidió propuesta formal/);
  });

  it("sin notas", () => {
    const summary = formatLeadNotesSummaryText({ fullName: "Melissa", notes: [] });
    assert.match(summary, /no tiene notas registradas/i);
  });
});

describe("ADD_LEAD_NOTE — integración conversacional Luis", () => {
  it("flujo: pedir nota → responder contenido", () => {
    const turn1 = resolveLeadNotePayload({
      userMessage: "Agregar nota a Luis Vargas",
      interpretation: { action: "ADD_LEAD_NOTE", leadName: "Luis Vargas", note: null }
    });
    assert.equal(turn1.leadName, "Luis Vargas");
    assert.equal(turn1.note, null);

    const turn2 = buildInterpretationFromAssistantContext(
      buildAddLeadNoteContext({ leadId: "lead-luis", leadName: "Luis Vargas" }),
      "Solicitó una propuesta formal."
    );
    assert.equal(turn2.action, "ADD_LEAD_NOTE");
    assert.equal(turn2.note, "Solicitó una propuesta formal.");
  });
});
