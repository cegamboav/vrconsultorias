/**
 * claude-followup-agent.js
 *
 * Agentic follow-up cycle powered by Claude.
 * The agent reads skills from the ./skills/ directory and uses a custom
 * "bash" tool to invoke the CRM CLI (cli.js) for every CRM operation.
 *
 * Uses spawnSync instead of execSync. The command is tokenised into an explicit
 * argv array before being passed to spawnSync — no shell interpolation occurs,
 * which prevents command injection even when messages contain special characters.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import Anthropic from '@anthropic-ai/sdk';
import { env } from '../config/env.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = join(__dirname, 'skills');
const CLI_PATH = join(__dirname, '../../cli.js');

// ---------------------------------------------------------------------------
// Skill loader
// ---------------------------------------------------------------------------

function loadSkills() {
  return readdirSync(SKILLS_DIR)
    .filter((f) => f.endsWith('.md'))
    .sort()
    .map((f) => readFileSync(join(SKILLS_DIR, f), 'utf8'))
    .join('\n\n---\n\n');
}

// ---------------------------------------------------------------------------
// CLI runner — uses spawnSync with an explicit argv array (no shell) so that
// messages containing spaces, quotes, or accented characters are safe.
// ---------------------------------------------------------------------------

/**
 * Parse a command string into an argv array, respecting single and double quotes.
 *
 * @param {string} command
 * @returns {string[]}
 */
function tokenize(command) {
  const tokens = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < command.length; i++) {
    const ch = command[i];

    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
    } else if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
    } else if (ch === ' ' && !inSingle && !inDouble) {
      if (current.length > 0) {
        tokens.push(current);
        current = '';
      }
    } else {
      current += ch;
    }
  }

  if (current.length > 0) tokens.push(current);
  return tokens;
}

/**
 * Run a CLI command and return its output.
 *
 * @param {string} command  Args after "node cli.js"
 * @returns {{ stdout: string, stderr: string, exitCode: number }}
 */
function runCli(command) {
  const args = tokenize(command.trim());

  // spawnSync with an explicit args array — no shell, no injection risk
  const result = spawnSync(process.execPath, [CLI_PATH, ...args], {
    encoding: 'utf8',
    timeout: 30_000,
  });

  return {
    stdout: (result.stdout ?? '').trim(),
    stderr: (result.stderr ?? '').trim(),
    exitCode: result.status ?? (result.error ? 1 : 0),
  };
}

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

/**
 * Run one full agentic follow-up cycle using Claude.
 *
 * @param {{ dryRun?: boolean, limit?: number }} [opts]
 * @returns {Promise<{ processed: number, skipped: number, errors: number }>}
 */
export async function runClaudeAgent({ dryRun = true, limit = 50 } = {}) {
  const apiKey = env.anthropic?.apiKey;
  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY is not set. Required when FOLLOW_UP_AGENT_MODE is "claude" or "both".'
    );
  }

  const modelId = env.followUpAgent.claudeModel;
  if (!modelId) {
    throw new Error(
      'CLAUDE_AGENT_MODEL is not set. Required when FOLLOW_UP_AGENT_MODE is "claude" or "both".'
    );
  }

  const client = new Anthropic({ apiKey });
  const systemPrompt = loadSkills();

  const today = new Date().toISOString().split('T')[0];

  const messages = [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: `Run the follow-up cycle for today (${today}).
Limit: ${limit} leads.
DryRun: ${dryRun}.

Use the CLI tool to work through all due leads following the workflow in your skills.
End your final message with a summary line like:
  Summary: processed=N, skipped=N, errors=N`,
        },
      ],
    },
  ];

  // Allow ~3 tool calls per lead (get / send / note) plus initial list-due + buffer
  const MAX_ITERATIONS = Math.max(20, 5 + 3 * limit);
  let iterations = 0;

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    const response = await client.messages.create({
      model: modelId,
      max_tokens: 4096,
      system: systemPrompt,
      tools: [
        {
          name: 'bash',
          description:
            'Execute a CRM CLI command. Pass arguments after "node cli.js", e.g. "leads list-due --limit 10".',
          input_schema: {
            type: 'object',
            properties: {
              command: {
                type: 'string',
                description:
                  'The CLI arguments after "node cli.js". Example: "leads list-due --limit 5"',
              },
            },
            required: ['command'],
          },
        },
      ],
      messages,
    });

    // Append the full assistant content block
    messages.push({ role: 'assistant', content: response.content });

    if (response.stop_reason === 'end_turn') break;

    if (response.stop_reason === 'tool_use') {
      const toolResults = [];

      for (const block of response.content) {
        if (block.type !== 'tool_use') continue;

        const command = block.input?.command ?? '';
        const result = runCli(command);

        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify({
            stdout: result.stdout,
            stderr: result.stderr,
            exit_code: result.exitCode,
          }),
        });
      }

      messages.push({ role: 'user', content: toolResults });
    }
  }

  // Parse summary from the agent's final text block.
  // The workflow skill instructs the agent to end with:
  //   Summary: processed=N, skipped=N, errors=N
  const lastText = messages
    .flatMap((m) => (Array.isArray(m.content) ? m.content : [m]))
    .filter((b) => b.type === 'text')
    .pop()?.text ?? '';

  const processedMatch = /processed[=:\s]+(\d+)/i.exec(lastText);
  const skippedMatch = /skipped[=:\s]+(\d+)/i.exec(lastText);
  const errorsMatch = /errors?[=:\s]+(\d+)/i.exec(lastText);

  return {
    processed: processedMatch ? parseInt(processedMatch[1], 10) : 0,
    skipped: skippedMatch ? parseInt(skippedMatch[1], 10) : 0,
    errors: errorsMatch ? parseInt(errorsMatch[1], 10) : 0,
  };
}
