import { prisma } from "@crm/database";

export const ASSISTANT_CONTEXT_TTL_MS = 15 * 60 * 1000;

export const PENDING_ACTIONS = {
  MOVE_LEAD_STATUS: "MOVE_LEAD_STATUS",
  SCHEDULE_FOLLOW_UP: "SCHEDULE_FOLLOW_UP",
  RESCHEDULE: "RESCHEDULE",
  ADD_NOTE: "ADD_NOTE",
  ADD_LEAD_NOTE: "ADD_LEAD_NOTE",
  RESUME_LEAD: "RESUME_LEAD",
  SUGGEST_NEXT_ACTION: "SUGGEST_NEXT_ACTION"
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
    pendingAction: row.pendingAction,
    leadId: row.leadId ?? null,
    leadName: row.leadName ?? null,
    metadata: row.metadata ?? null,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
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
      pendingAction,
      leadId: leadId ?? null,
      leadName: leadName ?? null,
      metadata: metadata ?? null,
      expiresAt
    },
    update: {
      pendingAction,
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
