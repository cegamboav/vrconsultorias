import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FollowUpReason, LeadStatus } from "@crm/database";
import { resolveLeadCandidateFromMessage } from "../services/assistant-lead-note.service.js";
import { buildInterpretationFromAssistantContext } from "../services/assistant-context-resolver.service.js";
import {
  buildResumeLeadDisambiguationContext,
  PENDING_ACTIONS
} from "../services/assistant-conversation-context.service.js";
import {
  buildCommercialSummary,
  buildResumeLeadDisambiguationReply,
  formatLeadResumeText,
  formatResumeDate
} from "../services/lead-resume.service.js";

const melissaLead = {
  fullName: "Melissa Granados",
  status: LeadStatus.FOLLOW_UP,
  followUpReason: FollowUpReason.NO_MONEY,
  followUpCount: 1,
  noInvestmentReason: null,
  serviceCategory: { name: "Contabilidad" },
  nextActionDate: new Date("2026-06-30"),
  createdAt: new Date("2026-05-25"),
  lastActivityAt: new Date("2026-05-31"),
  source: "DIRECTO"
};

const melissaNotes = [
  { text: "Quiere revisarlo con su esposo." },
  { text: "Está esperando una herencia." },
  { text: "Se va a contactar con nosotros la próxima semana." }
];

describe("RESUME_LEAD — resumen ejecutivo", () => {
  it("formato de texto incluye secciones principales", () => {
    const summaryText = formatLeadResumeText({
      fullName: "Melissa Granados",
      service: "Contabilidad",
      statusLabel: "Seguimiento",
      followUpReasonLabel: "No tiene liquidez",
      nextActionDateLabel: "30 jun 2026",
      createdAtLabel: "25 may 2026",
      sourceLabel: "Directo",
      notes: melissaNotes,
      lastActivityAtLabel: "31 may 2026",
      commercialSummary:
        "Melissa mostró interés en el servicio de contabilidad. Actualmente se encuentra en seguimiento por no tiene liquidez."
    });

    assert.match(summaryText, /Melissa Granados/);
    assert.match(summaryText, /Servicio:\nContabilidad/);
    assert.match(summaryText, /Estado actual:\nSeguimiento/);
    assert.match(summaryText, /Motivo seguimiento:\nNo tiene liquidez/);
    assert.match(summaryText, /Quiere revisarlo con su esposo/);
    assert.match(summaryText, /Resumen comercial:/);
  });

  it("resumen comercial con notas y FOLLOW_UP", () => {
    const text = buildCommercialSummary(melissaLead, melissaNotes);
    assert.match(text, /seguimiento/i);
    assert.match(text, /liquidez|herencia|evaluando|contacto/i);
  });

  it("resumen comercial lead concretado", () => {
    const text = buildCommercialSummary(
      {
        ...melissaLead,
        status: LeadStatus.CLOSED_SUCCESS,
        followUpCount: 2,
        followUpReason: null
      },
      []
    );
    assert.match(text, /concretado exitosamente/i);
    assert.match(text, /2 seguimiento/i);
  });

  it("formatResumeDate produce fecha legible", () => {
    const label = formatResumeDate(new Date("2026-06-30T12:00:00"));
    assert.match(label, /2026/);
    assert.match(label, /jun/i);
  });
});

describe("RESUME_LEAD — desambiguación Marielos", () => {
  const candidates = [
    { id: "lead-mp", leadNumber: 4, fullName: "Marielos Perez" },
    { id: "lead-mc", leadNumber: 6, fullName: "Marielos Castro" }
  ];

  it("mensaje de varias coincidencias numeradas", () => {
    const reply = buildResumeLeadDisambiguationReply(candidates);
    assert.match(reply, /1\. Marielos Perez/);
    assert.match(reply, /2\. Marielos Castro/);
    assert.match(reply, /¿De cuál deseas el resumen\?/);
  });

  it("contexto pendingDisambiguation RESUME_LEAD", () => {
    const ctx = buildResumeLeadDisambiguationContext({
      leadName: "Marielos",
      candidates
    });
    assert.equal(ctx.pendingAction, PENDING_ACTIONS.RESUME_LEAD);
    assert.equal(ctx.metadata.pendingDisambiguation, true);
  });

  it("turno 2: Marielos Perez → RESUME_LEAD con leadId", () => {
    const interpretation = buildInterpretationFromAssistantContext(
      buildResumeLeadDisambiguationContext({ leadName: "Marielos", candidates }),
      "Marielos Perez"
    );
    assert.equal(interpretation.action, "RESUME_LEAD");
    assert.equal(interpretation.leadId, "lead-mp");
    assert.equal(interpretation.leadName, "Marielos Perez");
  });

  it("resolveLeadCandidateFromMessage para resumen", () => {
    assert.equal(
      resolveLeadCandidateFromMessage("Marielos Perez", candidates).id,
      "lead-mp"
    );
  });
});

describe("RESUME_LEAD — intenciones (mapeo esperado)", () => {
  it("interpretación típica Resume a Melissa", () => {
    const interpretation = {
      action: "RESUME_LEAD",
      leadName: "Melissa"
    };
    assert.equal(interpretation.action, "RESUME_LEAD");
    assert.equal(interpretation.leadName, "Melissa");
  });

  it("interpretación ¿Qué sabes de Melissa?", () => {
    const interpretation = {
      action: "RESUME_LEAD",
      leadName: "Melissa Granados"
    };
    assert.equal(interpretation.leadName, "Melissa Granados");
  });
});
