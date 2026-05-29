import { FollowUpReason, LeadStatus } from "@crm/database";
import { ASSISTANT_ACTION_TYPES } from "./assistant.prompts.js";
import { statusChangeTimelineLabelEs } from "../constants/lead-copy.es.js";
import { AppError } from "../utils/app-error.js";
import { logAudit, AuditAction } from "../services/audit.service.js";
import { addLeadActivity } from "../services/activities.service.js";
import {
  applyFollowUpQuick,
  changeLeadStatus,
  getLeadById,
  searchLeadsForReferrer
} from "../services/leads.service.js";
import { toYmdLocal } from "../utils/follow-up-date.js";

export const EXECUTABLE_ACTIONS = new Set([
  "SEARCH_LEAD_BY_NAME",
  "MOVE_LEAD_STATUS",
  "SCHEDULE_FOLLOW_UP",
  "ADD_NOTE"
]);

const QUICK_FOLLOW_UP_DAYS = new Set([7, 15, 30, 90]);

function normalizeActionType(action) {
  const key = String(action ?? "")
    .trim()
    .toUpperCase();
  if (key === "MOVE_TO_FOLLOW_UP") {
    return "SCHEDULE_FOLLOW_UP";
  }
  return key;
}

function assertValidStatus(status) {
  if (!status || !Object.prototype.hasOwnProperty.call(LeadStatus, status)) {
    throw new AppError(
      `Estado no permitido. Usa uno de: ${Object.keys(LeadStatus).join(", ")}.`,
      400
    );
  }
}

function normalizeFollowUpReason(value) {
  if (value === undefined || value === null || value === "") {
    return FollowUpReason.OTHER;
  }
  const key = String(value).trim().toUpperCase();
  if (!Object.prototype.hasOwnProperty.call(FollowUpReason, key)) {
    throw new AppError(
      `Motivo de seguimiento no válido. Usa: ${Object.keys(FollowUpReason).join(", ")}.`,
      400
    );
  }
  return FollowUpReason[key];
}

/**
 * @param {{ leadId?: string|null, leadName?: string|null }} params
 */
export async function resolveLeadTarget({ leadId, leadName }) {
  if (leadId) {
    const lead = await getLeadById(String(leadId).trim());
    return { lead, ambiguous: false, candidates: [] };
  }

  const query = String(leadName ?? "").trim();
  if (query.length < 2) {
    throw new AppError("Indica el nombre del lead (mínimo 2 caracteres) o su id.", 400);
  }

  const candidates = await searchLeadsForReferrer({ query });
  if (candidates.length === 0) {
    throw new AppError(`No encontré ningún lead que coincida con «${query}».`, 404);
  }
  if (candidates.length > 1) {
    return { lead: null, ambiguous: true, candidates };
  }

  const lead = await getLeadById(candidates[0].id);
  return { lead, ambiguous: false, candidates: [] };
}

async function recordAssistantTimeline({
  leadId,
  userId,
  action,
  summary,
  userMessage,
  extraMetadata = {}
}) {
  await addLeadActivity({
    leadId,
    userId,
    payload: {
      type: "NOTE_ADDED",
      description: `[Asistente] ${summary}`,
      metadata: {
        source: "assistant",
        assistantAction: action,
        userMessage: userMessage ?? null,
        ...extraMetadata
      }
    }
  });
}

async function recordAssistantAudit({
  actorId,
  action,
  description,
  metadata
}) {
  await logAudit({
    actorId,
    action: AuditAction.ASSISTANT_ACTION_EXECUTED,
    description,
    metadata: {
      source: "assistant",
      assistantAction: action,
      ...metadata
    }
  });
}

/**
 * @param {{ interpretation: object, userId: string, userMessage: string }} ctx
 */
export async function executeAssistantAction({ interpretation, userId, userMessage }) {
  const action = normalizeActionType(interpretation.action);

  if (!EXECUTABLE_ACTIONS.has(action)) {
    throw new AppError("La intención no es ejecutable.", 400);
  }

  if (action === "SEARCH_LEAD_BY_NAME") {
    const query = String(interpretation.leadName ?? interpretation.query ?? "").trim();
    if (query.length < 2) {
      throw new AppError("Indica al menos 2 caracteres para buscar.", 400);
    }
    const leads = await searchLeadsForReferrer({ query });
    await logAudit({
      actorId: userId,
      action: AuditAction.ASSISTANT_ACTION_EXECUTED,
      description: `Búsqueda de lead vía asistente: «${query}».`,
      metadata: { source: "assistant", assistantAction: action, query, matchCount: leads.length }
    });
    return { action, leads };
  }

  const { lead, ambiguous, candidates } = await resolveLeadTarget({
    leadId: interpretation.leadId,
    leadName: interpretation.leadName
  });

  if (ambiguous) {
    return {
      action,
      executed: false,
      needsDisambiguation: true,
      candidates
    };
  }

  const leadId = lead.id;

  if (action === "ADD_NOTE") {
    const note = String(interpretation.note ?? "").trim();
    if (!note) {
      throw new AppError("La nota no puede estar vacía.", 400);
    }
    const activity = await addLeadActivity({
      leadId,
      userId,
      payload: {
        type: "NOTE_ADDED",
        description: note,
        metadata: {
          source: "assistant",
          assistantAction: action,
          userMessage: userMessage ?? null
        }
      }
    });
    await recordAssistantAudit({
      actorId: userId,
      action,
      description: `Nota vía asistente en lead ${lead.leadNumber} (${lead.fullName}).`,
      metadata: { leadId, leadNumber: lead.leadNumber }
    });
    const updated = await getLeadById(leadId);
    return { action, lead: updated, activity };
  }

  if (action === "MOVE_LEAD_STATUS") {
    const status = String(interpretation.status ?? "")
      .trim()
      .toUpperCase();
    assertValidStatus(status);

    if (status === LeadStatus.FOLLOW_UP) {
      throw new AppError(
        "Para poner en seguimiento usa la acción de programar seguimiento (días o fecha).",
        400
      );
    }

    const payload = { status };
    if (status === LeadStatus.CLOSED_LOST) {
      const reason = String(interpretation.noInvestmentReason ?? "").trim();
      if (!reason) {
        throw new AppError(
          "Para marcar como no concretado indica el motivo (noInvestmentReason).",
          400
        );
      }
      payload.noInvestmentReason = reason;
    }

    const updated = await changeLeadStatus({ leadId, userId, payload });
    const label = statusChangeTimelineLabelEs[status] ?? status;
    await recordAssistantTimeline({
      leadId,
      userId,
      action,
      summary: `Estado actualizado a ${label} para ${lead.fullName}.`,
      userMessage,
      extraMetadata: { status }
    });
    await recordAssistantAudit({
      actorId: userId,
      action,
      description: `Cambio de estado vía asistente → ${label} (${lead.leadNumber}).`,
      metadata: { leadId, status }
    });
    return { action, lead: updated };
  }

  if (action === "SCHEDULE_FOLLOW_UP") {
    const followUpReason = normalizeFollowUpReason(interpretation.followUpReason);
    let days;
    let nextActionDate;

    if (interpretation.nextActionDate) {
      nextActionDate = String(interpretation.nextActionDate).trim();
    } else if (interpretation.days !== undefined && interpretation.days !== null) {
      days = Number(interpretation.days);
      if (!QUICK_FOLLOW_UP_DAYS.has(days)) {
        throw new AppError("Los días de seguimiento rápido deben ser 7, 15, 30 o 90.", 400);
      }
    } else {
      throw new AppError("Indica days (7, 15, 30, 90) o nextActionDate (YYYY-MM-DD).", 400);
    }

    const updated = await applyFollowUpQuick({
      leadId,
      userId,
      days,
      nextActionDate,
      followUpReason
    });

    const scheduleLabel =
      days != null
        ? `${days} días`
        : nextActionDate ?? toYmdLocal(updated.nextActionDate);

    await recordAssistantTimeline({
      leadId,
      userId,
      action,
      summary: `Seguimiento programado (${scheduleLabel}) para ${lead.fullName}.`,
      userMessage,
      extraMetadata: { days: days ?? null, nextActionDate: scheduleLabel, followUpReason }
    });
    await recordAssistantAudit({
      actorId: userId,
      action,
      description: `Seguimiento vía asistente en lead ${lead.leadNumber}.`,
      metadata: { leadId, days, nextActionDate, followUpReason }
    });
    return { action, lead: updated };
  }

  throw new AppError("Acción de asistente no implementada.", 500);
}

export function normalizeInterpretation(raw) {
  const normalized = normalizeActionType(raw?.action);
  const action = EXECUTABLE_ACTIONS.has(normalized)
    ? normalized
    : ASSISTANT_ACTION_TYPES.includes(normalized)
      ? normalized
      : "UNKNOWN";
  return {
    action,
    leadName: raw?.leadName ?? null,
    leadId: raw?.leadId ?? null,
    status: raw?.status ? String(raw.status).trim().toUpperCase() : null,
    days: raw?.days !== undefined && raw?.days !== null ? Number(raw.days) : null,
    nextActionDate: raw?.nextActionDate ?? null,
    followUpReason: raw?.followUpReason
      ? String(raw.followUpReason).trim().toUpperCase()
      : null,
    note: raw?.note ?? null,
    noInvestmentReason: raw?.noInvestmentReason ?? null,
    clarification: raw?.clarification ?? null,
    confidence:
      typeof raw?.confidence === "number" && !Number.isNaN(raw.confidence)
        ? Math.min(1, Math.max(0, raw.confidence))
        : null
  };
}
