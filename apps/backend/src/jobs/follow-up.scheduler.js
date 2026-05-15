/**
 * follow-up.scheduler.js
 *
 * Wraps the follow-up agent in a node-cron schedule.
 * Reads configuration from env.followUpAgent (FOLLOW_UP_AGENT_* env vars).
 *
 * Call `startFollowUpAgent()` once at server start-up.
 */

import cron from 'node-cron';
import { env } from '../config/env.js';
import { runOnce } from '../services/follow-up-agent.service.js';

/**
 * Start the follow-up agent scheduler.
 * No-ops if FOLLOW_UP_AGENT_ENABLED is not 'true'.
 */
export function startFollowUpAgent() {
  if (!env.followUpAgent.enabled) {
    console.log(
      '[follow-up-agent] disabled — set FOLLOW_UP_AGENT_ENABLED=true to activate'
    );
    return;
  }

  console.log(
    `[follow-up-agent] scheduler starting — cron: ${env.followUpAgent.cron}, tz: ${env.followUpAgent.timezone}`
  );

  cron.schedule(
    env.followUpAgent.cron,
    async () => {
      console.log('[follow-up-agent] tick starting...');
      try {
        const result = await runOnce();
        console.log('[follow-up-agent] tick complete:', result);
      } catch (err) {
        console.error('[follow-up-agent] tick error:', err);
      }
    },
    { timezone: env.followUpAgent.timezone }
  );
}
