import { FollowUpReason, LeadStatus } from "@crm/database";
import { ASSISTANT_ACTION_TYPES } from "./assistant.prompts.js";
import { statusChangeTimelineLabelEs } from "../constants/lead-copy.es.js";
import { AppError } from "../utils/app-error.js";
import { logAudit, AuditAction } from "../services/audit.service.js";
import { addLeadActivity } from "../services/activities.service.js";
import {
  applyFollowUpQuick,
  applyCommercialFollowUp,
  changeLeadStatus,
  createLead,
  getAllowedNextStatuses,
  getLeadById,
  rankLeadNameMatch,
  rescheduleLeadAppointment,
  searchLeadsByNameQuery,
  searchLeadsForReferrer
} from "../services/leads.service.js";
import {
  formatActiveServiceNamesHint,
  resolveServiceCategoryByNameOrSlug
} from "../services/service-categories.service.js";
import {
  countLeadsByStatus,
  countLeadsForStatuses,
  listLeadsForStatuses,
  formatLeadDetailsSnapshot,
  formatLeadStatusSnapshot,
  getLeadDetailsById,
  getLeadStatusById,
  getOldestUncontactedLeads,
  getPendingFollowUpsDueToday
} from "../services/lead-queries.service.js";
import { getLeadTimelineSummaryByLeadId } from "../services/lead-timeline.service.js";
import { getOverdueFollowups, getTodayAgenda, getTomorrowAgenda, getActionableLeads, getUpcomingFollowups, resolveUpcomingFollowupsRange } from "../services/lead-agenda.service.js";
import { getPriorityLeads } from "../services/lead-priority.service.js";
import {
  buildSuggestNextActionDisambiguationReply,
  getSuggestedNextActionByLeadId
} from "../services/lead-suggest-action.service.js";
import { getCrmOverview } from "../services/lead-overview.service.js";
import {
  buildSmartStatusAuditDescription,
  buildSmartStatusTimelineSummary,
  inferNoInvestmentReason,
  normalizeSmartStatusPayload,
  resolveSmartFollowUpDays,
  resolveSmartFollowUpReason,
  resolveSmartStatusClarification,
  resolveSmartStatusLeadName,
  resolveSmartStatusLeadSearchQuery,
  resolveSmartStatusLeadTarget,
  validateSmartStatusPayload
} from "../services/smart-status.service.js";
import {
  buildAllowedTransitionsReply,
  buildMoveLeadStatusClarification,
  buildScheduleClarification
} from "../services/assistant-context-resolver.service.js";
import {
  buildAddLeadNoteClarification,
  buildAddLeadNoteChoiceReply,
  buildAddLeadNoteDisambiguationReply,
  buildLeadNotFoundReply,
  resolveLeadNotePayload
} from "../services/assistant-lead-note.service.js";
import {
  addAssistantLeadNote,
  formatLeadNotesSummaryText,
  getLeadNotesByLeadId
} from "../services/lead-notes.service.js";
import {
  buildCountAllLeadsReply,
  buildCountLeadsByStatusReply,
  buildListLeadsByStatusReply,
  buildListStatusClarification,
  resolveLeadStatusQueryFilter
} from "../services/lead-status-query.service.js";
import {
  buildResumeLeadDisambiguationReply,
  getLeadResumeByLeadId
} from "../services/lead-resume.service.js";
import {
  buildAddLeadNoteContext,
  buildAddLeadNoteDisambiguationContext,
  buildMoveLeadStatusContext,
  buildRescheduleContext,
  buildResumeLeadDisambiguationContext,
  buildScheduleFollowUpContext,
  buildSuggestNextActionDisambiguationContext
} from "../services/assistant-conversation-context.service.js";
import { toYmdLocal } from "../utils/follow-up-date.js";

export const EXECUTABLE_ACTIONS = new Set([
  "SEARCH_LEAD_BY_NAME",
  "MOVE_LEAD_STATUS",
  "SCHEDULE_FOLLOW_UP",
  "ADD_LEAD_NOTE",
  "GET_LEAD_NOTES",
  "GET_LEAD_STATUS",
  "GET_LEAD_DETAILS",
  "COUNT_LEADS_BY_STATUS",
  "LIST_LEADS_BY_STATUS",
  "GET_PENDING_FOLLOWUPS",
  "GET_TODAY_AGENDA",
  "GET_TOMORROW_AGENDA",
  "GET_ACTIONABLE_LEADS",
  "GET_UPCOMING_FOLLOWUPS",
  "GET_PRIORITY_LEADS",
  "GET_OVERDUE_FOLLOWUPS",
  "GET_OVERVIEW",
  "GET_OLDEST_UNCONTACTED_LEADS",
  "CREATE_LEAD",
  "SMART_STATUS_UPDATE",
  "GET_LEAD_TIMELINE_SUMMARY",
  "RESUME_LEAD",
  "SUGGEST_NEXT_ACTION",
  "GET_ALLOWED_TRANSITIONS",
  "RESCHEDULE_APPOINTMENT"
]);

const LEAD_TARGET_ACTIONS = new Set([
  "MOVE_LEAD_STATUS",
  "SCHEDULE_FOLLOW_UP",
  "ADD_LEAD_NOTE",
  "GET_LEAD_NOTES",
  "GET_LEAD_STATUS",
  "GET_LEAD_DETAILS",
  "GET_LEAD_TIMELINE_SUMMARY",
  "GET_ALLOWED_TRANSITIONS",
  "RESCHEDULE_APPOINTMENT"
]);

const QUICK_FOLLOW_UP_DAYS = new Set([7, 15, 30, 90]);

function normalizeActionType(action) {
  const key = String(action ?? "")
    .trim()
    .toUpperCase();
  if (key === "MOVE_TO_FOLLOW_UP") {
    return "SCHEDULE_FOLLOW_UP";
  }
  if (key === "ADD_NOTE") {
    return "ADD_LEAD_NOTE";
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

async function recordAssistantAudit({ actorId, action, description, metadata }) {
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

function buildClarifyResult(clarification, persistContext = null) {
  return {
    needsClarification: true,
    clarification,
    ...(persistContext ? { persistContext } : {})
  };
}

/**
 * Resuelve lead para SMART_STATUS_UPDATE con nombre normalizado (nunca el mensaje completo).
 */
export async function resolveLeadTargetForSmartStatus({
  leadId,
  leadName,
  userMessage,
  interpretation
}) {
  try {
    return await resolveSmartStatusLeadTarget({
      leadId,
      leadName,
      userMessage,
      interpretation,
      getLeadById,
      searchLeadsByNameQuery,
      rankLeadNameMatch
    });
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    const message = error.message;
    if (message.startsWith("No encontré ningún lead llamado")) {
      throw new AppError(message, 404);
    }
    throw new AppError(message, 400);
  }
}

async function validateCreateLeadInput(interpretation) {
  const fullName = String(interpretation.fullName ?? "").trim();
  const phone = String(interpretation.phone ?? "").trim();
  const serviceCategory = String(interpretation.serviceCategory ?? "").trim();

  if (!fullName) {
    return buildClarifyResult("Necesito el nombre completo para crear el lead.");
  }
  if (!phone) {
    return buildClarifyResult("Necesito el teléfono para crear el lead.");
  }
  if (!serviceCategory) {
    const hint = await formatActiveServiceNamesHint();
    return buildClarifyResult(
      hint ? `Necesito indicar el servicio (${hint}).` : "Necesito indicar el servicio."
    );
  }
  return null;
}

export function isCreateLeadInputComplete(interpretation) {
  const fullName = String(interpretation.fullName ?? "").trim();
  const phone = String(interpretation.phone ?? "").trim();
  const serviceCategory = String(interpretation.serviceCategory ?? "").trim();
  return Boolean(fullName && phone && serviceCategory);
}

/**
 * Crea un lead vía servicios del CRM (reutilizable desde conversación guiada o CREATE_LEAD directo).
 * @param {{ interpretation: object, userId: string, userMessage?: string|null, resolvedCategory?: object|null }} params
 */
export async function executeCreateLeadFromAssistant({
  interpretation,
  userId,
  userMessage = null,
  resolvedCategory = null
}) {
  const missing = await validateCreateLeadInput(interpretation);
  if (missing) {
    return missing;
  }

  let category = resolvedCategory;
  if (!category) {
    const serviceQuery = String(interpretation.serviceCategory ?? "").trim();
    const resolved = await resolveServiceCategoryByNameOrSlug(serviceQuery);

    if (resolved.ambiguous) {
      const names = resolved.candidates.map((c) => c.name).join(", ");
      return buildClarifyResult(
        `Encontré varios servicios posibles: ${names}. ¿Cuál corresponde?`
      );
    }

    if (resolved.notFound || !resolved.category) {
      const hint = await formatActiveServiceNamesHint();
      return buildClarifyResult(
        hint ? `Necesito indicar el servicio (${hint}).` : "Necesito indicar el servicio."
      );
    }

    category = resolved.category;
  }

  try {
    const lead = await createLead({
      userId,
      payload: {
        fullName: String(interpretation.fullName).trim(),
        phone: String(interpretation.phone).trim(),
        email: interpretation.email ?? null,
        observations: interpretation.observations ?? null,
        referredBy: interpretation.referredBy ?? null,
        serviceCategoryId: category.id,
        source: "DIRECTO"
      }
    });

    await recordAssistantAudit({
      actorId: userId,
      action: "CREATE_LEAD",
      description: `Lead #${lead.leadNumber} creado vía asistente (${lead.fullName}).`,
      metadata: {
        leadId: lead.id,
        leadNumber: lead.leadNumber,
        serviceCategoryId: category.id,
        userMessage: userMessage ?? null,
        viaConversation: Boolean(resolvedCategory)
      }
    });

    return {
      action: "CREATE_LEAD",
      leadNumber: lead.leadNumber,
      fullName: lead.fullName,
      status: lead.status,
      service: lead.serviceCategory?.name ?? category.name,
      leadId: lead.id
    };
  } catch (error) {
    if (error instanceof AppError && error.statusCode === 409) {
      return buildClarifyResult("Ya existe un lead con ese teléfono.");
    }
    throw error;
  }
}

/**
 * @param {{ interpretation: object, userId: string, userMessage: string }} ctx
 */
async function executeSmartStatusUpdate({ interpretation, userId, userMessage }) {
  const action = "SMART_STATUS_UPDATE";
  const payload = normalizeSmartStatusPayload(interpretation);

  const clarification = resolveSmartStatusClarification(payload);
  if (clarification) {
    const persistContext =
      payload.targetStatus === LeadStatus.SCHEDULED
        ? buildRescheduleContext({
            leadName: payload.leadName ?? interpretation.leadName,
            metadata: { targetStatus: LeadStatus.SCHEDULED }
          })
        : null;
    return buildClarifyResult(clarification, persistContext);
  }

  const validationError = validateSmartStatusPayload(payload);
  if (validationError) {
    return buildClarifyResult(validationError);
  }

  let leadResult;
  try {
    leadResult = await resolveLeadTargetForSmartStatus({
      leadId: payload.leadId ?? interpretation.leadId,
      leadName: payload.leadName ?? interpretation.leadName,
      userMessage,
      interpretation
    });
  } catch (error) {
    if (error instanceof AppError && error.statusCode === 404) {
      const name =
        resolveSmartStatusLeadSearchQuery({
          userMessage,
          interpretation,
          leadName: payload.leadName ?? interpretation.leadName
        }) ??
        payload.leadName ??
        interpretation.leadName ??
        "ese nombre";
      return buildClarifyResult(`No encontré ningún lead llamado ${name}.`);
    }
    if (error instanceof AppError) {
      return buildClarifyResult(error.message);
    }
    throw error;
  }

  const { lead, ambiguous, candidates, resolvedQuery } = leadResult;
  if (ambiguous) {
    return {
      action,
      executed: false,
      needsDisambiguation: true,
      candidates,
      leadName: resolvedQuery ?? payload.leadName ?? interpretation.leadName
    };
  }

  const leadId = lead.id;
  const targetStatus = payload.targetStatus;

  try {
    if (targetStatus === LeadStatus.FOLLOW_UP) {
      const followUpReason = resolveSmartFollowUpReason(payload);
      const days = resolveSmartFollowUpDays({ ...payload, followUpReason });
      const updated = await applyCommercialFollowUp({
        leadId,
        userId,
        days,
        followUpReason
      });
      const timelineSummary = buildSmartStatusTimelineSummary({
        targetStatus,
        followUpReason
      });
      await recordAssistantTimeline({
        leadId,
        userId,
        action,
        summary: timelineSummary,
        userMessage,
        extraMetadata: { targetStatus, followUpReason, days, smartStatus: true }
      });
      await recordAssistantAudit({
        actorId: userId,
        action,
        description: buildSmartStatusAuditDescription({
          leadNumber: lead.leadNumber,
          fullName: lead.fullName,
          targetStatus,
          followUpReason,
          days
        }),
        metadata: { leadId, targetStatus, followUpReason, days, smartStatus: true }
      });
      return {
        action,
        smartStatus: true,
        targetStatus,
        followUpReason,
        days,
        lead: updated,
        fullName: updated.fullName,
        resolvedQuery
      };
    }

    if (targetStatus === LeadStatus.CLOSED_SUCCESS) {
      const updated = await changeLeadStatus({
        leadId,
        userId,
        payload: { status: LeadStatus.CLOSED_SUCCESS }
      });
      const timelineSummary = buildSmartStatusTimelineSummary({ targetStatus });
      await recordAssistantTimeline({
        leadId,
        userId,
        action,
        summary: timelineSummary,
        userMessage,
        extraMetadata: { targetStatus, smartStatus: true }
      });
      await recordAssistantAudit({
        actorId: userId,
        action,
        description: buildSmartStatusAuditDescription({
          leadNumber: lead.leadNumber,
          fullName: lead.fullName,
          targetStatus
        }),
        metadata: { leadId, targetStatus, smartStatus: true }
      });
      return {
        action,
        smartStatus: true,
        targetStatus,
        lead: updated,
        fullName: updated.fullName,
        resolvedQuery
      };
    }

    if (targetStatus === LeadStatus.CLOSED_LOST) {
      const noInvestmentReason = inferNoInvestmentReason(payload, userMessage);
      const updated = await changeLeadStatus({
        leadId,
        userId,
        payload: { status: LeadStatus.CLOSED_LOST, noInvestmentReason }
      });
      const timelineSummary = buildSmartStatusTimelineSummary({ targetStatus });
      await recordAssistantTimeline({
        leadId,
        userId,
        action,
        summary: timelineSummary,
        userMessage,
        extraMetadata: { targetStatus, smartStatus: true, noInvestmentReason }
      });
      await recordAssistantAudit({
        actorId: userId,
        action,
        description: buildSmartStatusAuditDescription({
          leadNumber: lead.leadNumber,
          fullName: lead.fullName,
          targetStatus
        }),
        metadata: { leadId, targetStatus, smartStatus: true, noInvestmentReason }
      });
      return {
        action,
        smartStatus: true,
        targetStatus,
        lead: updated,
        fullName: updated.fullName,
        resolvedQuery
      };
    }
  } catch (error) {
    if (error instanceof AppError) {
      return buildClarifyResult(error.message);
    }
    throw error;
  }

  return buildClarifyResult("No pude aplicar la actualización comercial.");
}

/**
 * @param {{ interpretation: object, userId: string, userMessage: string }} ctx
 */
async function executeAddLeadNote({ interpretation, userId, userMessage }) {
  const action = "ADD_LEAD_NOTE";
  const payload = resolveLeadNotePayload({ userMessage, interpretation });

  if (!payload.leadName && !interpretation.leadId) {
    return buildClarifyResult("Indica el nombre del lead para agregar la nota.");
  }

  let leadResult;
  try {
    leadResult = await resolveLeadTarget({
      leadId: interpretation.leadId,
      leadName: payload.leadName ?? interpretation.leadName
    });
  } catch (error) {
    if (error instanceof AppError && error.statusCode === 404) {
      return buildClarifyResult(
        buildLeadNotFoundReply(payload.leadName ?? interpretation.leadName)
      );
    }
    if (error instanceof AppError) {
      return buildClarifyResult(error.message);
    }
    throw error;
  }

  const { lead, ambiguous, candidates } = leadResult;
  if (ambiguous) {
    const queryName = payload.leadName ?? interpretation.leadName;
    return {
      action,
      executed: false,
      needsDisambiguation: true,
      candidates,
      disambiguationMessage: buildAddLeadNoteChoiceReply(candidates),
      persistContext: buildAddLeadNoteDisambiguationContext({
        leadName: queryName,
        candidates
      })
    };
  }

  const note = payload.note;
  if (!note) {
    return buildClarifyResult(
      buildAddLeadNoteClarification(lead.fullName),
      buildAddLeadNoteContext({ leadId: lead.id, leadName: lead.fullName })
    );
  }

  const activity = await addAssistantLeadNote({
    leadId: lead.id,
    userId,
    note,
    assistantAction: action
  });

  await recordAssistantAudit({
    actorId: userId,
    action,
    description: `Nota vía asistente en lead ${lead.leadNumber} (${lead.fullName}).`,
    metadata: { leadId: lead.id, leadNumber: lead.leadNumber, notePreview: note.slice(0, 120) }
  });

  const updated = await getLeadById(lead.id);
  return {
    action,
    lead: updated,
    activity,
    fullName: updated.fullName
  };
}

/**
 * @param {{ interpretation: object, userId: string }} ctx
 */
async function executeResumeLead({ interpretation, userId }) {
  const action = "RESUME_LEAD";
  const leadName = String(interpretation.leadName ?? "").trim();

  if (!leadName && !interpretation.leadId) {
    return buildClarifyResult("Indica el nombre del lead para generar el resumen.");
  }

  let leadResult;
  try {
    leadResult = await resolveLeadTarget({
      leadId: interpretation.leadId,
      leadName: leadName || interpretation.leadName
    });
  } catch (error) {
    if (error instanceof AppError && error.statusCode === 404) {
      return buildClarifyResult(buildLeadNotFoundReply(leadName || interpretation.leadName));
    }
    if (error instanceof AppError) {
      return buildClarifyResult(error.message);
    }
    throw error;
  }

  const { lead, ambiguous, candidates } = leadResult;
  if (ambiguous) {
    return {
      action,
      executed: false,
      needsDisambiguation: true,
      candidates,
      disambiguationMessage: buildResumeLeadDisambiguationReply(candidates),
      persistContext: buildResumeLeadDisambiguationContext({
        leadName: leadName || interpretation.leadName,
        candidates
      })
    };
  }

  const resume = await getLeadResumeByLeadId(lead.id);

  await recordAssistantAudit({
    actorId: userId,
    action,
    description: `Resumen ejecutivo vía asistente (${lead.leadNumber} · ${lead.fullName}).`,
    metadata: {
      leadId: lead.id,
      noteCount: resume.notes.length,
      status: resume.status
    }
  });

  return resume;
}

/**
 * @param {{ interpretation: object, userId: string }} ctx
 */
async function executeSuggestNextAction({ interpretation, userId }) {
  const action = "SUGGEST_NEXT_ACTION";
  const leadName = String(interpretation.leadName ?? "").trim();

  if (!leadName && !interpretation.leadId) {
    return buildClarifyResult("Indica el nombre del lead para generar la recomendación.");
  }

  let leadResult;
  try {
    leadResult = await resolveLeadTarget({
      leadId: interpretation.leadId,
      leadName: leadName || interpretation.leadName
    });
  } catch (error) {
    if (error instanceof AppError && error.statusCode === 404) {
      return buildClarifyResult(buildLeadNotFoundReply(leadName || interpretation.leadName));
    }
    if (error instanceof AppError) {
      return buildClarifyResult(error.message);
    }
    throw error;
  }

  const { lead, ambiguous, candidates } = leadResult;
  if (ambiguous) {
    return {
      action,
      executed: false,
      needsDisambiguation: true,
      candidates,
      disambiguationMessage: buildSuggestNextActionDisambiguationReply(candidates),
      persistContext: buildSuggestNextActionDisambiguationContext({
        leadName: leadName || interpretation.leadName,
        candidates
      })
    };
  }

  const suggestion = await getSuggestedNextActionByLeadId(lead.id);

  await recordAssistantAudit({
    actorId: userId,
    action,
    description: `Recomendación comercial vía asistente (${lead.leadNumber} · ${lead.fullName}).`,
    metadata: {
      leadId: lead.id,
      status: suggestion.status,
      followUpReason: suggestion.followUpReason
    }
  });

  return suggestion;
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
    await recordAssistantAudit({
      actorId: userId,
      action,
      description: `Búsqueda de lead vía asistente: «${query}».`,
      metadata: { query, matchCount: leads.length }
    });
    return { action, leads };
  }

  if (action === "COUNT_LEADS_BY_STATUS") {
    const filter = resolveLeadStatusQueryFilter(interpretation, userMessage);
    if (filter) {
      const data = await countLeadsForStatuses(filter.statuses);
      await recordAssistantAudit({
        actorId: userId,
        action,
        description: `Conteo de leads (${filter.listTitle}) vía asistente.`,
        metadata: { count: data.count, statuses: filter.statuses, isOpen: filter.isOpen }
      });
      return {
        action,
        count: data.count,
        filter,
        replyText: buildCountLeadsByStatusReply(data.count, filter)
      };
    }

    const data = await countLeadsByStatus();
    await recordAssistantAudit({
      actorId: userId,
      action,
      description: "Consulta de conteo de leads por estado vía asistente.",
      metadata: { total: data.total }
    });
    return {
      action,
      ...data,
      replyText: buildCountAllLeadsReply(data)
    };
  }

  if (action === "LIST_LEADS_BY_STATUS") {
    const filter = resolveLeadStatusQueryFilter(interpretation, userMessage);
    if (!filter) {
      return buildClarifyResult(buildListStatusClarification());
    }

    const data = await listLeadsForStatuses(filter.statuses);
    await recordAssistantAudit({
      actorId: userId,
      action,
      description: `Listado de leads (${filter.listTitle}) vía asistente.`,
      metadata: { count: data.count, statuses: filter.statuses, isOpen: filter.isOpen }
    });
    return {
      action,
      ...data,
      filter,
      replyText: buildListLeadsByStatusReply({
        leads: data.leads,
        count: data.count,
        filter
      })
    };
  }

  if (action === "GET_PENDING_FOLLOWUPS") {
    const data = await getPendingFollowUpsDueToday();
    await recordAssistantAudit({
      actorId: userId,
      action,
      description: "Consulta de seguimientos pendientes vía asistente.",
      metadata: { count: data.count }
    });
    return { action, ...data };
  }

  if (action === "GET_TODAY_AGENDA") {
    const data = await getTodayAgenda();
    await recordAssistantAudit({
      actorId: userId,
      action,
      description: "Consulta de agenda operativa del día vía asistente.",
      metadata: { count: data.count }
    });
    return { action, ...data };
  }

  if (action === "GET_TOMORROW_AGENDA") {
    const data = await getTomorrowAgenda();
    await recordAssistantAudit({
      actorId: userId,
      action,
      description: "Consulta de agenda de mañana vía asistente.",
      metadata: { count: data.count }
    });
    return { action, ...data };
  }

  if (action === "GET_ACTIONABLE_LEADS") {
    const data = await getActionableLeads();
    await recordAssistantAudit({
      actorId: userId,
      action,
      description: "Consulta de agenda comercial accionable vía asistente.",
      metadata: { count: data.count }
    });
    return data;
  }

  if (action === "GET_UPCOMING_FOLLOWUPS") {
    const range = resolveUpcomingFollowupsRange(userMessage, interpretation);
    const data = await getUpcomingFollowups({
      rangeStart: range.rangeStart,
      rangeEndExclusive: range.rangeEndExclusive
    });
    await recordAssistantAudit({
      actorId: userId,
      action,
      description: "Consulta de seguimientos próximos vía asistente.",
      metadata: { count: data.count, scope: range.scope }
    });
    return { ...data, scope: range.scope };
  }

  if (action === "GET_PRIORITY_LEADS") {
    const data = await getPriorityLeads();
    await recordAssistantAudit({
      actorId: userId,
      action,
      description: "Consulta de priorización comercial vía asistente.",
      metadata: { count: data.count, topScore: data.leads[0]?.priorityScore ?? null }
    });
    return data;
  }

  if (action === "GET_OVERDUE_FOLLOWUPS") {
    const data = await getOverdueFollowups();
    await recordAssistantAudit({
      actorId: userId,
      action,
      description: "Consulta de seguimientos atrasados vía asistente.",
      metadata: { count: data.count }
    });
    return { action, ...data };
  }

  if (action === "GET_OVERVIEW") {
    const data = await getCrmOverview();
    await recordAssistantAudit({
      actorId: userId,
      action,
      description: "Consulta de resumen general del CRM vía asistente.",
      metadata: {
        total: data.total,
        todayPendingCount: data.todayPendingCount,
        tomorrowScheduledCount: data.tomorrowScheduledCount,
        overdueFollowupsCount: data.overdueFollowupsCount
      }
    });
    return { action, ...data };
  }

  if (action === "GET_OLDEST_UNCONTACTED_LEADS") {
    const data = await getOldestUncontactedLeads();
    await recordAssistantAudit({
      actorId: userId,
      action,
      description: "Consulta de leads sin contactar vía asistente.",
      metadata: { count: data.count }
    });
    return { action, ...data };
  }

  if (action === "CREATE_LEAD") {
    return executeCreateLeadFromAssistant({
      interpretation,
      userId,
      userMessage
    });
  }

  if (action === "SMART_STATUS_UPDATE") {
    return executeSmartStatusUpdate({ interpretation, userId, userMessage });
  }

  if (action === "ADD_LEAD_NOTE") {
    return executeAddLeadNote({ interpretation, userId, userMessage });
  }

  if (action === "RESUME_LEAD") {
    return executeResumeLead({ interpretation, userId });
  }

  if (action === "SUGGEST_NEXT_ACTION") {
    return executeSuggestNextAction({ interpretation, userId });
  }

  if (!LEAD_TARGET_ACTIONS.has(action)) {
    throw new AppError("Acción de asistente no implementada.", 500);
  }

  const { lead, ambiguous, candidates } = await resolveLeadTarget({
    leadId: interpretation.leadId,
    leadName: interpretation.leadName
  });

  if (ambiguous) {
    const disambiguationMessage =
      action === "ADD_LEAD_NOTE"
        ? buildAddLeadNoteDisambiguationReply(interpretation.leadName)
        : undefined;
    return {
      action,
      executed: false,
      needsDisambiguation: true,
      candidates,
      ...(disambiguationMessage ? { disambiguationMessage } : {})
    };
  }

  const leadId = lead.id;

  if (action === "GET_LEAD_STATUS") {
    const statusSnapshot =
      lead.serviceCategory !== undefined
        ? formatLeadStatusSnapshot(lead)
        : await getLeadStatusById(leadId);
    await recordAssistantAudit({
      actorId: userId,
      action,
      description: `Consulta de estado vía asistente (${lead.leadNumber} · ${lead.fullName}).`,
      metadata: { leadId, leadNumber: lead.leadNumber, status: statusSnapshot.status }
    });
    return { action, leadId, leadNumber: lead.leadNumber, ...statusSnapshot };
  }

  if (action === "GET_LEAD_DETAILS") {
    const details =
      lead.serviceCategory !== undefined && lead.phone !== undefined
        ? formatLeadDetailsSnapshot(lead)
        : await getLeadDetailsById(leadId);
    await recordAssistantAudit({
      actorId: userId,
      action,
      description: `Consulta de detalle vía asistente (${lead.leadNumber} · ${lead.fullName}).`,
      metadata: { leadId, leadNumber: lead.leadNumber }
    });
    return { action, leadId, ...details };
  }

  if (action === "GET_LEAD_TIMELINE_SUMMARY") {
    const timeline = await getLeadTimelineSummaryByLeadId(leadId);
    await recordAssistantAudit({
      actorId: userId,
      action,
      description: `Resumen de historial vía asistente (${lead.leadNumber} · ${lead.fullName}).`,
      metadata: {
        leadId,
        leadNumber: lead.leadNumber,
        hasHistory: timeline.hasHistory,
        bulletCount: timeline.bullets.length
      }
    });
    return { action, leadId, ...timeline };
  }

  if (action === "GET_LEAD_NOTES") {
    const notesData = await getLeadNotesByLeadId(leadId);
    const summaryText = formatLeadNotesSummaryText({
      fullName: notesData.fullName,
      notes: notesData.notes
    });
    await recordAssistantAudit({
      actorId: userId,
      action,
      description: `Consulta de notas vía asistente (${lead.leadNumber} · ${lead.fullName}).`,
      metadata: { leadId, noteCount: notesData.count }
    });
    return {
      action,
      leadId,
      fullName: notesData.fullName,
      count: notesData.count,
      notes: notesData.notes,
      summaryText
    };
  }

  if (action === "GET_ALLOWED_TRANSITIONS") {
    const allowedStatuses = getAllowedNextStatuses(lead.status);
    const replyText = buildAllowedTransitionsReply({
      fullName: lead.fullName,
      currentStatus: lead.status,
      allowedStatuses
    });
    await recordAssistantAudit({
      actorId: userId,
      action,
      description: `Consulta de transiciones vía asistente (${lead.leadNumber} · ${lead.fullName}).`,
      metadata: { leadId, currentStatus: lead.status, allowedStatuses }
    });
    return {
      action,
      lead,
      leadId,
      fullName: lead.fullName,
      currentStatus: lead.status,
      allowedStatuses,
      replyText,
      persistContext: buildMoveLeadStatusContext({
        leadId: lead.id,
        leadName: lead.fullName
      })
    };
  }

  if (action === "RESCHEDULE_APPOINTMENT") {
    const nextActionDate = String(interpretation.nextActionDate ?? "").trim();
    if (!nextActionDate) {
      return buildClarifyResult(
        buildScheduleClarification(lead.fullName),
        buildRescheduleContext({
          leadId: lead.id,
          leadName: lead.fullName,
          metadata: { targetStatus: LeadStatus.SCHEDULED }
        })
      );
    }
    const updated = await rescheduleLeadAppointment({
      leadId,
      userId,
      nextActionDate
    });
    await recordAssistantTimeline({
      leadId,
      userId,
      action: "SCHEDULE_FOLLOW_UP",
      summary: `Cita reprogramada para ${lead.fullName}.`,
      userMessage,
      extraMetadata: { nextActionDate }
    });
    await recordAssistantAudit({
      actorId: userId,
      action: "RESCHEDULE_APPOINTMENT",
      description: `Reprogramación vía asistente en lead ${lead.leadNumber}.`,
      metadata: { leadId, nextActionDate }
    });
    return { action: "RESCHEDULE_APPOINTMENT", lead: updated };
  }

  if (action === "MOVE_LEAD_STATUS") {
    const status = String(interpretation.status ?? "")
      .trim()
      .toUpperCase();
    if (!status) {
      return buildClarifyResult(
        buildMoveLeadStatusClarification(lead.fullName),
        buildMoveLeadStatusContext({ leadId: lead.id, leadName: lead.fullName })
      );
    }
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
      return buildClarifyResult(
        buildScheduleClarification(lead.fullName),
        buildScheduleFollowUpContext({
          leadId: lead.id,
          leadName: lead.fullName,
          metadata: { followUpReason }
        })
      );
    }

    const updated = await applyFollowUpQuick({
      leadId,
      userId,
      days,
      nextActionDate,
      followUpReason
    });

    const scheduleLabel =
      days != null ? `${days} días` : (nextActionDate ?? toYmdLocal(updated.nextActionDate));

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
  const action =
    normalized === "CREATE_LEAD_CONVERSATION"
      ? "CREATE_LEAD_CONVERSATION"
      : normalized === "SMART_STATUS_UPDATE"
        ? "SMART_STATUS_UPDATE"
        : EXECUTABLE_ACTIONS.has(normalized)
          ? normalized
          : ASSISTANT_ACTION_TYPES.includes(normalized)
            ? normalized
            : "UNKNOWN";

  const smart = normalizeSmartStatusPayload(raw);

  return {
    action,
    fullName: raw?.fullName ? String(raw.fullName).trim() : null,
    phone: raw?.phone ? String(raw.phone).trim() : null,
    serviceCategory:
      raw?.serviceCategory != null && String(raw.serviceCategory).trim() !== ""
        ? String(raw.serviceCategory).trim()
        : raw?.service != null && String(raw.service).trim() !== ""
          ? String(raw.service).trim()
          : null,
    email: raw?.email ?? null,
    observations: raw?.observations ?? null,
    referredBy: raw?.referredBy ?? null,
    leadName: raw?.leadName ?? smart.leadName ?? null,
    leadId: raw?.leadId ?? smart.leadId ?? null,
    query: raw?.query ?? null,
    status: raw?.status ? String(raw.status).trim().toUpperCase() : null,
    statusScope: raw?.statusScope
      ? String(raw.statusScope).trim().toUpperCase()
      : raw?.scope
        ? String(raw.scope).trim().toUpperCase()
        : null,
    targetStatus: smart.targetStatus ?? null,
    suggestedDays: smart.suggestedDays,
    requiresClarification: smart.requiresClarification,
    days: raw?.days !== undefined && raw?.days !== null ? Number(raw.days) : smart.suggestedDays,
    nextActionDate: raw?.nextActionDate ?? null,
    followUpReason: raw?.followUpReason
      ? String(raw.followUpReason).trim().toUpperCase()
      : smart.followUpReason,
    note: raw?.note ?? null,
    noInvestmentReason: raw?.noInvestmentReason ?? smart.noInvestmentReason ?? null,
    clarification: raw?.clarification ?? smart.clarification ?? null,
    confidence:
      typeof raw?.confidence === "number" && !Number.isNaN(raw.confidence)
        ? Math.min(1, Math.max(0, raw.confidence))
        : null
  };
}
