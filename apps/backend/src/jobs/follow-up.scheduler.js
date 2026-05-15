/**
 * follow-up.scheduler.js
 *
 * Wraps the follow-up agent in a node-cron schedule.
 * Reads configuration from env.followUpAgent (FOLLOW_UP_AGENT_* env vars).
 *
 * Modes (FOLLOW_UP_AGENT_MODE):
 *   - 'rule-based' (default) — uses the deterministic template-based agent
 *   - 'claude'               — uses the Claude AI agentic cycle
 *   - 'both'                 — runs both in sequence
 *
 * Call `startFollowUpAgent()` once at server start-up.
 */

import cron from 'node-cron';
import { env } from '../config/env.js';
import { runOnce } from '../services/follow-up-agent.service.js';

/**
 * Dispatch one tick based on the configured mode.
 *
 * The Claude agent module is imported dynamically so that the scheduler does
 * not fail at startup if @anthropic-ai/sdk is not installed.
 */
async function runTick() {
  const mode = env.followUpAgent.mode;

  if (mode === 'claude' || mode === 'both') {
    const { runClaudeAgent } = await import('../agent/claude-followup-agent.js');
    const result = await runClaudeAgent({
      dryRun: env.followUpAgent.dryRun,
      limit: env.followUpAgent.batchSize,
    });
    console.log('[follow-up-agent] claude tick complete:', result);
  }

  if (mode === 'rule-based' || mode === 'both') {
    const result = await runOnce();
    console.log('[follow-up-agent] rule-based tick complete:', result);
  }

  if (mode !== 'claude' && mode !== 'rule-based' && mode !== 'both') {
    console.warn(`[follow-up-agent] unknown mode "${mode}" — defaulting to rule-based`);
    const result = await runOnce();
    console.log('[follow-up-agent] rule-based tick complete:', result);
  }
}

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
    `[follow-up-agent] scheduler starting — cron: ${env.followUpAgent.cron}, tz: ${env.followUpAgent.timezone}, mode: ${env.followUpAgent.mode}`
  );

  cron.schedule(
    env.followUpAgent.cron,
    async () => {
      console.log('[follow-up-agent] tick starting...');
      try {
        await runTick();
      } catch (err) {
        console.error('[follow-up-agent] tick error:', err);
      }
    },
    { timezone: env.followUpAgent.timezone }
  );
}
