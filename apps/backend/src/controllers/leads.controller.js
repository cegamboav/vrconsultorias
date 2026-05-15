import { asyncHandler } from "../utils/async-handler.js";
import {
  addLeadActivity,
  applyFollowUpQuick,
  changeLeadStatus,
  createLead,
  getLeadById,
  listLeads,
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

  // Accept explicit boolean from JSON body; any non-boolean is treated as false
  // (never send in dry-run mode by accident from a manual trigger).
  const dryRun =
    typeof req.body?.dryRun === 'boolean' ? req.body.dryRun : false;

  const result = await processLead(lead, { dryRun });
  res.status(200).json({ result });
});
