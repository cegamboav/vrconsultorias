import { asyncHandler } from "../utils/async-handler.js";
import {
  addLeadActivity,
  changeLeadStatus,
  createLead,
  getLeadById,
  listLeads
} from "../services/leads.service.js";

export const list = asyncHandler(async (_req, res) => {
  const leads = await listLeads();
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

export const patchStatus = asyncHandler(async (req, res) => {
  const lead = await changeLeadStatus({
    leadId: req.params.id,
    userId: req.user.id,
    payload: req.body
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

