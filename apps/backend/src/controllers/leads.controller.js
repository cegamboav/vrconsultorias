import { asyncHandler } from "../utils/async-handler.js";
import { AppError } from "../utils/app-error.js";
import { prisma } from "@crm/database";
import {
  addLeadActivity,
  applyFollowUpQuick,
  changeLeadStatus,
  createLead,
  getLeadById,
  listLeads,
  reopenLostLead,
  searchLeadsForReferrer,
  updateLead
} from "../services/leads.service.js";
import { processLead } from "../services/follow-up-agent.service.js";

export const list = asyncHandler(async (_req, res) => {
  const leads = await listLeads();
  res.status(200).json({ leads });
});

export const searchReferrers = asyncHandler(async (req, res) => {
  const leads = await searchLeadsForReferrer({
    query: req.query.q,
    excludeLeadId: req.query.excludeId
  });
  res.status(200).json({ leads });
});

export const create = asyncHandler(async (req, res) => {
  const lead = await createLead({ userId: req.user.id, payload: req.body });
  res.status(201).json({ lead });
});

export const getById = asyncHandler(async (req, res) => {
  const lead = await getLeadById(req.params.id);
  res.status(200).json({ lead });
});

export const patch = asyncHandler(async (req, res) => {
  const lead = await updateLead({
    leadId: req.params.id,
    userId: req.user.id,
    payload: req.body
  });
  res.status(200).json({ lead });
});

export const patchStatus = asyncHandler(async (req, res) => {
  const lead = await changeLeadStatus({
    leadId: req.params.id,
    userId: req.user.id,
    payload: req.body
  });
  res.status(200).json({ lead });
});

export const reopen = asyncHandler(async (req, res) => {
  const lead = await reopenLostLead({
    leadId: req.params.id,
    userId: req.user.id,
    payload: req.body ?? {}
  });
  res.status(200).json({ lead });
});

export const followUpQuick = asyncHandler(async (req, res) => {
  const lead = await applyFollowUpQuick({
    leadId: req.params.id,
    userId: req.user.id,
    days: req.body?.days,
    nextActionDate: req.body?.nextActionDate,
    followUpReason: req.body?.followUpReason
  });
  res.status(200).json({ lead });
});

export const createActivity = asyncHandler(async (req, res) => {
  const activity = await addLeadActivity({
    leadId: req.params.id,
    userId: req.user.id,
    payload: req.body
  });
  res.status(201).json({ activity });
});

/**
 * POST /api/private/leads/:id/whatsapp/send
 * Manually trigger a WhatsApp message for a specific lead.
 * Body (optional):
 *   - dryRun {boolean} – when true, simulates send without calling the provider
 */
export const sendWhatsApp = asyncHandler(async (req, res) => {
  const lead = await getLeadById(req.params.id);

  // Only leads in FOLLOW_UP state are eligible for a WhatsApp send.
  // Any other status means the lead is not ready or the send is nonsensical.
  if (lead.status !== 'FOLLOW_UP') {
    throw new AppError('Solo se puede enviar WhatsApp a leads en estado FOLLOW_UP.', 400);
  }

  // Accept explicit boolean from JSON body; any non-boolean is treated as false
  // (never send in dry-run mode by accident from a manual trigger).
  const dryRun =
    typeof req.body?.dryRun === 'boolean' ? req.body.dryRun : false;

  const result = await processLead(lead, { dryRun });

  // Use 422 when the provider or business logic rejected the send so the
  // caller can distinguish a successful no-op from a processing failure.
  const statusCode = result.success ? 200 : 422;
  res.status(statusCode).json({ result });
});

/**
 * PATCH /api/private/leads/:id/activities/:activityId/suggestion
 * Update the suggestion status of a WHATSAPP_RECEIVED activity.
 * Body: { status: 'sent' | 'discarded', sentText?: string }
 */
export const updateSuggestion = asyncHandler(async (req, res) => {
  const leadId = req.params.id;
  const { activityId } = req.params;
  const { status, sentText } = req.body;

  if (!['sent', 'discarded'].includes(status)) {
    throw new AppError('status must be "sent" or "discarded".', 400);
  }

  const activity = await prisma.activity.findFirst({
    where: { id: activityId, leadId, type: 'WHATSAPP_RECEIVED' },
  });

  if (!activity) throw new AppError('Activity not found.', 404);

  // Prevent duplicate WHATSAPP_SENT activity if suggestion was already processed
  if (activity.metadata?.suggestionStatus && activity.metadata.suggestionStatus !== 'pending') {
    throw new AppError('Suggestion has already been processed.', 409);
  }

  const updatedActivity = await prisma.activity.update({
    where: { id: activityId },
    data: {
      metadata: {
        ...(activity.metadata ?? {}),
        suggestionStatus: status,
        ...(status === 'sent' && sentText ? { sentText } : {}),
      },
    },
  });

  // If marked as sent, create a WHATSAPP_SENT activity to record the reply
  if (status === 'sent' && sentText) {
    await prisma.activity.create({
      data: {
        leadId,
        userId: req.user.id,
        type: 'WHATSAPP_SENT',
        description: `WhatsApp enviado (respuesta manual): "${sentText.slice(0, 80)}${sentText.length > 80 ? '...' : ''}"`,
        metadata: {
          provider: 'manual',
          providerMessageId: null,
          dryRun: false,
          nextActionDateAtSend: null,
          sentText,
          inResponseToActivityId: activityId,
        },
      },
    });
  }

  res.status(200).json({ activity: updatedActivity });
});
