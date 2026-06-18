import { prisma } from "@crm/database";

export const ASSISTANT_CONTEXT_TTL_MS = 15 * 60 * 1000;

export const PENDING_ACTIONS = {
  MOVE_LEAD_STATUS: "MOVE_LEAD_STATUS",
  SCHEDULE_FOLLOW_UP: "SCHEDULE_FOLLOW_UP",
  RESCHEDULE: "RESCHEDULE",
  ADD_NOTE: "ADD_NOTE",
  ADD_LEAD_NOTE: "ADD_LEAD_NOTE",
  RESUME_LEAD: "RESUME_LEAD",
  SUGGEST_NEXT_ACTION: "SUGGEST_NEXT_ACTION",
  GENERATE_CONTACT_MESSAGE: "GENERATE_CONTACT_MESSAGE",
  GENERATE_MULTIPLE_CONTACT_MESSAGES: "GENERATE_MULTIPLE_CONTACT_MESSAGES",
  MULTIPLE_MESSAGE_SELECTION: "MULTIPLE_MESSAGE_SELECTION",
  MESSAGE_REFINEMENT: "MESSAGE_REFINEMENT"
};

/**
 * @typedef {object} AssistantContextRecord
 * @property {string} id
 * @property {string} userId
 * @property {string} pendingAction
 * @property {string|null} leadId
 * @property {string|null} leadName
 * @property {object|null} metadata
 * @property {Date} expiresAt
 * @property {Date} createdAt
 * @property {Date} updatedAt
 */

function toContextRecord(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.userId,
    pendingAction: String(row.pendingAction ?? "").trim(),
    leadId: row.leadId ?? null,
    leadName: row.leadName ?? null,
    metadata: row.metadata ?? null,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

/**
 * @param {object|null|undefined} context
 * @returns {Record<string, unknown>}
 */
export function readAssistantContextMetadata(context) {
  let metadata = context?.metadata;
  if (typeof metadata === "string") {
    try {
      metadata = JSON.parse(metadata);
    } catch {
      return {};
    }
  }
  return metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata : {};
}

/**
 * @param {object|null|undefined} context
 * @returns {string}
 */
export function getRefinementContextMessage(context) {
  const metadata = readAssistantContextMetadata(context);
  return String(metadata.message ?? "").trim();
}

export async function purgeExpiredAssistantContexts() {
  await prisma.assistantConversationContext.deleteMany({
    where: { expiresAt: { lt: new Date() } }
  });
}

/**
 * @param {string} userId
 * @returns {Promise<AssistantContextRecord|null>}
 */
export async function getActiveAssistantContext(userId) {
  await purgeExpiredAssistantContexts();

  const row = await prisma.assistantConversationContext.findUnique({
    where: { userId }
  });

  if (!row) return null;

  if (row.expiresAt.getTime() <= Date.now()) {
    await prisma.assistantConversationContext.delete({ where: { userId } });
    return null;
  }

  return toContextRecord(row);
}

/**
 * @param {{
 *   userId: string,
 *   pendingAction: string,
 *   leadId?: string|null,
 *   leadName?: string|null,
 *   metadata?: object|null
 * }} params
 */
export async function saveAssistantContext({
  userId,
  pendingAction,
  leadId = null,
  leadName = null,
  metadata = null
}) {
  const expiresAt = new Date(Date.now() + ASSISTANT_CONTEXT_TTL_MS);

  const row = await prisma.assistantConversationContext.upsert({
    where: { userId },
    create: {
      userId,
      pendingAction: String(pendingAction ?? "").trim(),
      leadId: leadId ?? null,
      leadName: leadName ?? null,
      metadata: metadata ?? null,
      expiresAt
    },
    update: {
      pendingAction: String(pendingAction ?? "").trim(),
      leadId: leadId ?? null,
      leadName: leadName ?? null,
      metadata: metadata ?? null,
      expiresAt
    }
  });

  return toContextRecord(row);
}

export async function clearAssistantContext(userId) {
  try {
    await prisma.assistantConversationContext.delete({ where: { userId } });
  } catch {
    // no active context
  }
}

export function buildMoveLeadStatusContext({ leadId, leadName }) {
  return {
    pendingAction: PENDING_ACTIONS.MOVE_LEAD_STATUS,
    leadId: leadId ?? null,
    leadName: leadName ?? null,
    metadata: null
  };
}

export function buildScheduleFollowUpContext({ leadId, leadName, metadata = null }) {
  return {
    pendingAction: PENDING_ACTIONS.SCHEDULE_FOLLOW_UP,
    leadId: leadId ?? null,
    leadName: leadName ?? null,
    metadata
  };
}

export function buildRescheduleContext({ leadId, leadName, metadata = null }) {
  return {
    pendingAction: PENDING_ACTIONS.RESCHEDULE,
    leadId: leadId ?? null,
    leadName: leadName ?? null,
    metadata
  };
}

export function buildAddNoteContext({ leadId, leadName }) {
  return {
    pendingAction: PENDING_ACTIONS.ADD_LEAD_NOTE,
    leadId: leadId ?? null,
    leadName: leadName ?? null,
    metadata: null
  };
}

export function buildAddLeadNoteContext({ leadId, leadName }) {
  return buildAddNoteContext({ leadId, leadName });
}

/**
 * Contexto cuando hay varios leads con el mismo nombre parcial.
 * @param {{ leadName?: string|null, candidates: Array<{ id: string, leadNumber: number, fullName: string }> }} params
 */
export function buildAddLeadNoteDisambiguationContext({ leadName, candidates }) {
  return {
    pendingAction: PENDING_ACTIONS.ADD_LEAD_NOTE,
    leadId: null,
    leadName: leadName ?? null,
    metadata: {
      pendingDisambiguation: true,
      candidates: (candidates ?? []).slice(0, 10).map((c) => ({
        id: c.id,
        leadNumber: c.leadNumber,
        fullName: c.fullName
      }))
    }
  };
}

export function buildResumeLeadDisambiguationContext({ leadName, candidates }) {
  return {
    pendingAction: PENDING_ACTIONS.RESUME_LEAD,
    leadId: null,
    leadName: leadName ?? null,
    metadata: {
      pendingDisambiguation: true,
      candidates: (candidates ?? []).slice(0, 10).map((c) => ({
        id: c.id,
        leadNumber: c.leadNumber,
        fullName: c.fullName
      }))
    }
  };
}

export function buildSuggestNextActionDisambiguationContext({ leadName, candidates }) {
  return {
    pendingAction: PENDING_ACTIONS.SUGGEST_NEXT_ACTION,
    leadId: null,
    leadName: leadName ?? null,
    metadata: {
      pendingDisambiguation: true,
      candidates: (candidates ?? []).slice(0, 10).map((c) => ({
        id: c.id,
        leadNumber: c.leadNumber,
        fullName: c.fullName
      }))
    }
  };
}

export function buildGenerateContactMessageDisambiguationContext({
  leadName,
  candidates,
  preferences = null
}) {
  return {
    pendingAction: PENDING_ACTIONS.GENERATE_CONTACT_MESSAGE,
    leadId: null,
    leadName: leadName ?? null,
    metadata: {
      pendingDisambiguation: true,
      candidates: (candidates ?? []).slice(0, 10).map((c) => ({
        id: c.id,
        leadNumber: c.leadNumber,
        fullName: c.fullName
      })),
      messagePreferences: preferences ?? null
    }
  };
}

export function buildGenerateMultipleContactMessagesDisambiguationContext({ leadName, candidates }) {
  return {
    pendingAction: PENDING_ACTIONS.GENERATE_MULTIPLE_CONTACT_MESSAGES,
    leadId: null,
    leadName: leadName ?? null,
    metadata: {
      pendingDisambiguation: true,
      candidates: (candidates ?? []).slice(0, 10).map((c) => ({
        id: c.id,
        leadNumber: c.leadNumber,
        fullName: c.fullName
      }))
    }
  };
}

/**
 * @param {{ leadId: string, leadName: string, options: Array<{ style: string, message: string, label?: string }> }} params
 */
export function buildMultipleMessageSelectionContext({ leadId, leadName, options }) {
  return {
    pendingAction: PENDING_ACTIONS.MULTIPLE_MESSAGE_SELECTION,
    leadId: leadId ?? null,
    leadName: leadName ?? null,
    metadata: {
      options: (options ?? []).map((option, index) => ({
        index: index + 1,
        style: option.style,
        message: option.message,
        label: option.label ?? option.style
      }))
    }
  };
}

/**
 * @param {{ leadId: string, leadName: string, selectedStyle: string, message: string }} params
 */
export function buildMessageRefinementContext({ leadId, leadName, selectedStyle, message }) {
  return {
    pendingAction: PENDING_ACTIONS.MESSAGE_REFINEMENT,
    leadId: leadId ?? null,
    leadName: leadName ?? null,
    metadata: {
      selectedStyle: selectedStyle ?? null,
      message: message ?? ""
    }
  };
}
