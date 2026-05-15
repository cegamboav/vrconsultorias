/**
 * follow-up-agent.routes.js
 *
 * Private routes for the WhatsApp follow-up agent.
 * All routes require authentication (requireAuth is mounted in app.js).
 */

import { Router } from 'express';
import { requireRole } from '../../middlewares/auth.middleware.js';
import {
  getDue,
  getConfig,
  postRun,
} from '../../controllers/follow-up-agent.controller.js';

const followUpAgentRouter = Router();

// GET /api/private/follow-up-agent/due
// List leads currently due for a WhatsApp follow-up.
followUpAgentRouter.get('/due', getDue);

// POST /api/private/follow-up-agent/run
// Manually trigger one agent cycle (useful for testing / backfill).
// Restricted to ADMIN: triggering a batch send is a privileged operation.
followUpAgentRouter.post('/run', requireRole('ADMIN'), postRun);

// GET /api/private/follow-up-agent/config
// Expose agent configuration to the frontend (enabled flag, dryRun mode).
followUpAgentRouter.get('/config', getConfig);

export default followUpAgentRouter;
