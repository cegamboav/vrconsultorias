#!/usr/bin/env node
/**
 * cli.js — CRM command-line interface
 *
 * Usage:
 *   node cli.js <resource> <command> [<id>] [options]
 *
 * Resources / commands:
 *   leads list-due [--limit N]
 *   leads get <id>
 *   leads send-whatsapp <id> [--message "text"] [--dry-run]
 *   leads add-note <id> --text "text"
 *   leads update-status <id> --status STATUS
 *   leads reschedule <id> [--days N | --date YYYY-MM-DD]
 *
 * All success output → stdout as JSON.
 * All errors → stderr as JSON, exit code 1.
 */

import { prisma } from '@crm/database';
import {
  listDue,
  getLead,
  sendWhatsApp,
  addNote,
  updateStatus,
  reschedule,
} from './src/cli/leads.commands.js';

// ---------------------------------------------------------------------------
// Arg parser
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const result = {};
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) {
        // Boolean flag (e.g. --dry-run)
        result[key] = true;
        i++;
      } else {
        result[key] = next;
        i += 2;
      }
    } else {
      i++;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const raw = process.argv;
  const resource = raw[2];
  const command = raw[3];
  // argv[4] is positional only if it exists and doesn't start with '--'
  const positionalId = (raw[4] && !raw[4].startsWith('--')) ? raw[4] : undefined;
  // Flags start after the positional ID (if present) or at argv[4] if no positional
  const flagsStart = positionalId ? 5 : 4;
  const flags = parseArgs(raw.slice(flagsStart));
  // Prefer positional ID, fall back to --id flag
  const id = positionalId ?? flags.id;

  if (!resource || !command) {
    printError('Usage: node cli.js <resource> <command> [<id>] [options]', 'USAGE');
    process.exit(1);
  }

  if (resource !== 'leads') {
    printError(`Unknown resource "${resource}". Available: leads`, 'UNKNOWN_RESOURCE');
    process.exit(1);
  }

  // Normalise --dry-run (kebab) to dryRun (camel)
  const dryRun =
    flags['dry-run'] === true || flags['dry-run'] === 'true' || flags['dryRun'] === true;

  let result;

  try {
    switch (command) {
      case 'list-due': {
        const limit = flags.limit !== undefined ? Number(flags.limit) : 50;
        result = await listDue({ limit });
        break;
      }

      case 'get': {
        result = await getLead({ id });
        break;
      }

      case 'send-whatsapp': {
        const message = flags.message ?? null;
        result = await sendWhatsApp({ id, message: message || undefined, dryRun });
        break;
      }

      case 'add-note': {
        const text = flags.text ?? null;
        result = await addNote({ id, text });
        break;
      }

      case 'update-status': {
        const status = flags.status ?? null;
        result = await updateStatus({ id, status });
        break;
      }

      case 'reschedule': {
        const days = flags.days !== undefined ? Number(flags.days) : undefined;
        const date = flags.date ?? undefined;
        result = await reschedule({ id, days, date });
        break;
      }

      default:
        printError(
          `Unknown command "${command}". Available: list-due, get, send-whatsapp, add-note, update-status, reschedule`,
          'UNKNOWN_COMMAND'
        );
        process.exit(1);
    }
  } catch (err) {
    const code = err.code ?? 'COMMAND_ERROR';
    printError(err.message, code);
    await prisma.$disconnect().catch(() => {});
    process.exit(1);
  }

  await prisma.$disconnect().catch(() => {});
  console.log(JSON.stringify(result));
  process.exit(0);
}

function printError(message, code) {
  process.stderr.write(JSON.stringify({ error: message, code }) + '\n');
}

main().catch(async (err) => {
  printError(err.message ?? String(err), 'FATAL');
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
