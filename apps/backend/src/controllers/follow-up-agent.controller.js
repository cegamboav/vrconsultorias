/**
 * follow-up-agent.controller.js
 *
 * Thin controller layer for the follow-up agent endpoints.
 * All business logic lives in follow-up-agent.service.js.
 */

import { asyncHandler } from '../utils/async-handler.js';
import { env } from '../config/env.js';
import { findDueLeads, runOnce } from '../services/follow-up-agent.service.js';

/**
 * GET /api/private/follow-up-agent/due
 * Returns leads currently due for follow-up (status=FOLLOW_UP, nextActionDate <= now).
 */
export const getDue = asyncHandler(async (_req, res) => {
  const leads = await findDueLeads({
    now: new Date(),
    limit: 50,
  });
  res.status(200).json({ leads });
});

/**
 * POST /api/private/follow-up-agent/run
 * Triggers one full agent cycle.
 * Body (optional):
 *   - dryRun {boolean} – override the env default
 *   - limit  {number}  – override the env batch size
 */
export const postRun = asyncHandler(async (req, res) => {
  // Input coercion with safe fallbacks; booleans from JSON are already the
  // right type, but guard against accidental string submissions.
  const dryRun =
    typeof req.body?.dryRun === 'boolean'
      ? req.body.dryRun
      : env.followUpAgent.dryRun;

  const rawLimit = req.body?.limit;
  const limit =
    typeof rawLimit === 'number' && Number.isInteger(rawLimit) && rawLimit > 0
      ? Math.min(rawLimit, 200)
      : env.followUpAgent.batchSize;

  const results = await runOnce({ dryRun, limit });
  res.status(200).json({ results });
});

/**
 * GET /api/private/follow-up-agent/config
 * Returns the current agent configuration visible to the frontend.
 * Never exposes raw env secrets.
 */
export const getConfig = asyncHandler(async (_req, res) => {
  res.status(200).json({
    enabled: env.followUpAgent.enabled,
    dryRun: env.followUpAgent.dryRun,
    mode: env.followUpAgent.mode,
  });
});
