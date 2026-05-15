/**
 * follow-up-agent.service.js
 *
 * Core follow-up agent: queries leads due for follow-up, checks idempotency,
 * sends (or dry-runs) a WhatsApp message via the configured provider, and
 * logs an Activity in the database.
 */

import { prisma, ActivityType } from '@crm/database';
import { env } from '../config/env.js';
import { whatsappProvider } from './whatsapp/index.js';
import { getTemplateOrThrow, interpolate } from './whatsapp/templates.es.js';
import { toE164 } from '../utils/phone.js';

/**
 * Return leads whose status is FOLLOW_UP and whose nextActionDate is <= now.
 *
 * @param {{ now: Date, limit?: number }} options
 * @returns {Promise<import('@prisma/client').Lead[]>}
 */
export async function findDueLeads({ now, limit = 50 }) {
  return prisma.lead.findMany({
    where: {
      status: 'FOLLOW_UP',
      nextActionDate: { lte: now },
    },
    include: { owner: true },
    take: limit,
    orderBy: { nextActionDate: 'asc' },
  });
}

/**
 * Check whether a WHATSAPP_SENT activity already exists for this lead for the
 * current nextActionDate cycle (idempotency guard).
 *
 * We fetch the most recent WHATSAPP_SENT activity and compare its stored
 * `nextActionDateAtSend` metadata value to the lead's current nextActionDate.
 *
 * @param {import('@prisma/client').Lead} lead
 * @returns {Promise<boolean>}
 */
export async function isAlreadyProcessed(lead) {
  if (!lead.nextActionDate) return false;

  const existing = await prisma.activity.findFirst({
    where: {
      leadId: lead.id,
      // Include REMINDER_CREATED so that a failed send in the current cycle
      // prevents re-attempting (and accumulating error activities) until the
      // lead is rescheduled to a new nextActionDate.
      type: { in: [ActivityType.WHATSAPP_SENT, ActivityType.REMINDER_CREATED] },
    },
    orderBy: { createdAt: 'desc' },
  });

  return (
    existing?.metadata?.nextActionDateAtSend ===
    lead.nextActionDate.toISOString()
  );
}

/**
 * Process a single lead: resolve template, normalise phone, send (or
 * dry-run) the WhatsApp message, and write the Activity record.
 *
 * @param {import('@prisma/client').Lead & { owner: import('@prisma/client').User | null }} lead
 * @param {{ dryRun: boolean }} options
 * @returns {Promise<{ success: boolean, leadId: string, dryRun: boolean, templateKey?: string, error?: string }>}
 */
export async function processLead(lead, { dryRun }) {
  let activityType = ActivityType.WHATSAPP_SENT;
  let providerResult = null;
  let messageText = '';
  let template = null;
  let error = null;

  try {
    // 1. Resolve template
    template = getTemplateOrThrow('FOLLOW_UP', lead.followUpReason ?? undefined);

    // 2. Normalise phone
    const normalizedPhone = toE164(lead.phone);

    // 3. Build variables
    const variables = {
      fullName: lead.fullName ?? '',
      ownerName: lead.owner?.name ?? '',
      calendlyUrl: lead.owner?.calendly ?? '',
    };

    // 4. Build message text
    messageText = interpolate(template.text, variables);

    // 5. Send or dry-run
    if (dryRun) {
      providerResult = { providerMessageId: null, status: 'DRY_RUN', raw: null };
    } else {
      providerResult = await whatsappProvider.sendTemplate({
        to: normalizedPhone,
        templateKey: template.templateKey,
        variables,
        leadId: lead.id,
      });
    }
  } catch (err) {
    error = err;
    activityType = ActivityType.REMINDER_CREATED;
    providerResult = providerResult ?? { providerMessageId: null, status: 'ERROR', raw: null };
  }

  // 6-8. Write Activity + update lastActivityAt in a transaction
  try {
    await prisma.$transaction(async (tx) => {
      await tx.lead.update({
        where: { id: lead.id },
        data: { lastActivityAt: new Date() },
      });

      await tx.activity.create({
        data: {
          leadId: lead.id,
          userId: null, // system-initiated
          type: activityType,
          description: dryRun
            ? `[Simulación] WhatsApp programado: "${messageText.slice(0, 80)}..."`
            : error
            ? `Error al enviar WhatsApp: ${error.message}`
            : `WhatsApp enviado: "${messageText.slice(0, 80)}..."`,
          metadata: {
            provider: env.whatsapp.provider,
            providerMessageId: providerResult?.providerMessageId ?? null,
            templateKey: template?.templateKey ?? null,
            dryRun,
            nextActionDateAtSend: lead.nextActionDate?.toISOString() ?? null,
            ...(error ? { error: error.message } : {}),
          },
        },
      });
    });
  } catch (txErr) {
    // Transaction failure is always a hard error
    console.error('[follow-up-agent] transaction failed for lead', lead.id, txErr);
    return { success: false, leadId: lead.id, error: txErr.message };
  }

  if (error) {
    return { success: false, leadId: lead.id, error: error.message };
  }

  return { success: true, leadId: lead.id, dryRun, templateKey: template.templateKey };
}

/**
 * Run one full agent cycle: fetch due leads, skip already-processed ones,
 * process the rest.
 *
 * @param {{ now?: Date, dryRun?: boolean, limit?: number }} [options]
 * @returns {Promise<{ processed: number, skipped: number, errors: number }>}
 */
export async function runOnce({
  now = new Date(),
  dryRun = env.followUpAgent.dryRun,
  limit = env.followUpAgent.batchSize,
} = {}) {
  const leads = await findDueLeads({ now, limit });
  const results = { processed: 0, skipped: 0, errors: 0 };

  for (const lead of leads) {
    const alreadyDone = await isAlreadyProcessed(lead);
    if (alreadyDone) {
      results.skipped++;
      continue;
    }

    const result = await processLead(lead, { dryRun });
    if (result.success) results.processed++;
    else results.errors++;
  }

  console.log(`[follow-up-agent] runOnce done: ${JSON.stringify(results)}`);
  return results;
}
