/**
 * leads.commands.js
 *
 * Command handlers for the leads CLI. Each function receives parsed args
 * and returns a plain object that the CLI entrypoint prints as JSON.
 * All functions use Prisma directly (or delegate to existing services).
 */

import { prisma, ActivityType } from '@crm/database';
import { processLead } from '../services/follow-up-agent.service.js';
import { whatsappProvider } from '../services/whatsapp/index.js';
import { toE164 } from '../utils/phone.js';

// ---------------------------------------------------------------------------
// list-due
// ---------------------------------------------------------------------------

/**
 * Return leads in FOLLOW_UP status whose nextActionDate is in the past.
 *
 * @param {{ limit?: number }} [opts]
 * @returns {Promise<{ leads: Array<object> }>}
 */
export async function listDue({ limit = 50 } = {}) {
  const leads = await prisma.lead.findMany({
    where: {
      status: 'FOLLOW_UP',
      nextActionDate: { lte: new Date() },
    },
    include: { owner: true },
    take: Number(limit),
    orderBy: { nextActionDate: 'asc' },
  });

  return {
    leads: leads.map((l) => ({
      id: l.id,
      leadNumber: l.leadNumber,
      fullName: l.fullName,
      phone: l.phone,
      followUpReason: l.followUpReason,
      nextActionDate: l.nextActionDate?.toISOString() ?? null,
      owner: l.owner
        ? { name: l.owner.name, calendly: l.owner.calendly ?? null }
        : null,
    })),
  };
}

// ---------------------------------------------------------------------------
// get
// ---------------------------------------------------------------------------

/**
 * Return a single lead with full details and the last 15 activities.
 *
 * @param {{ id: string }} opts
 * @returns {Promise<{ lead: object }>}
 */
export async function getLead({ id }) {
  if (!id) throw Object.assign(new Error('id is required'), { code: 'MISSING_ID' });

  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      owner: true,
      activities: {
        orderBy: { createdAt: 'desc' },
        take: 15,
      },
    },
  });

  if (!lead) throw Object.assign(new Error(`Lead ${id} not found`), { code: 'NOT_FOUND' });

  return {
    lead: {
      id: lead.id,
      leadNumber: lead.leadNumber,
      fullName: lead.fullName,
      phone: lead.phone,
      email: lead.email,
      status: lead.status,
      source: lead.source,
      followUpReason: lead.followUpReason,
      followUpCount: lead.followUpCount,
      nextActionDate: lead.nextActionDate?.toISOString() ?? null,
      lastActivityAt: lead.lastActivityAt?.toISOString() ?? null,
      createdAt: lead.createdAt.toISOString(),
      observations: lead.observations,
      owner: lead.owner
        ? { id: lead.owner.id, name: lead.owner.name, calendly: lead.owner.calendly ?? null }
        : null,
      activities: lead.activities.map((a) => ({
        id: a.id,
        type: a.type,
        description: a.description,
        metadata: a.metadata,
        createdAt: a.createdAt.toISOString(),
      })),
    },
  };
}

// ---------------------------------------------------------------------------
// send-whatsapp
// ---------------------------------------------------------------------------

/**
 * Send (or simulate) a WhatsApp message to the lead.
 * If `message` is provided, write the activity directly with that custom text.
 * Otherwise, delegate to processLead() which resolves the template.
 *
 * @param {{ id: string, message?: string, dryRun?: boolean }} opts
 * @returns {Promise<{ status: string, activityId: string|null, dryRun: boolean, phone: string }>}
 */
export async function sendWhatsApp({ id, message, dryRun = false }) {
  if (!id) throw Object.assign(new Error('id is required'), { code: 'MISSING_ID' });

  const lead = await prisma.lead.findUnique({
    where: { id },
    include: { owner: true },
  });

  if (!lead) throw Object.assign(new Error(`Lead ${id} not found`), { code: 'NOT_FOUND' });

  if (message) {
    // Custom message path — call the provider then write activity
    const text = String(message);

    // Call the provider so the message is dispatched (noop is safe without credentials).
    // Custom free-text messages are not truly template-based; when Meta is connected,
    // this would need sendMessage() instead. For now, sendTemplate with key 'custom'
    // is handled gracefully by the noop provider.
    let providerResult = { providerMessageId: null, status: 'DRY_RUN', raw: null };
    if (!dryRun) {
      const normalizedPhone = toE164(lead.phone);
      providerResult = await whatsappProvider.sendTemplate({
        to: normalizedPhone,
        templateKey: 'custom',
        variables: { fullName: lead.fullName ?? '', ownerName: '', calendlyUrl: '' },
        leadId: lead.id,
      });
    }

    const activity = await prisma.activity.create({
      data: {
        leadId: lead.id,
        userId: null,
        type: ActivityType.WHATSAPP_SENT,
        description: dryRun
          ? `[Simulación] WhatsApp: "${text.slice(0, 80)}..."`
          : `WhatsApp enviado: "${text.slice(0, 80)}..."`,
        metadata: {
          provider: 'custom',
          providerMessageId: providerResult.providerMessageId,
          dryRun,
          nextActionDateAtSend: lead.nextActionDate?.toISOString() ?? null,
          customMessage: true,
        },
      },
    });

    // Update lastActivityAt
    await prisma.lead.update({
      where: { id: lead.id },
      data: { lastActivityAt: new Date() },
    });

    return {
      status: dryRun ? 'DRY_RUN' : 'SENT',
      activityId: activity.id,
      dryRun,
      phone: lead.phone,
    };
  }

  // Template path — delegate to processLead
  const result = await processLead(lead, { dryRun });

  return {
    status: result.success ? (dryRun ? 'DRY_RUN' : 'SENT') : 'ERROR',
    activityId: null,
    dryRun,
    phone: lead.phone,
    error: result.error ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// add-note
// ---------------------------------------------------------------------------

/**
 * Append a NOTE_ADDED activity to the lead.
 *
 * @param {{ id: string, text: string }} opts
 * @returns {Promise<{ activityId: string }>}
 */
export async function addNote({ id, text }) {
  if (!id) throw Object.assign(new Error('id is required'), { code: 'MISSING_ID' });
  if (!text) throw Object.assign(new Error('--text is required'), { code: 'MISSING_TEXT' });

  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) throw Object.assign(new Error(`Lead ${id} not found`), { code: 'NOT_FOUND' });

  const activity = await prisma.activity.create({
    data: {
      leadId: id,
      userId: null,
      type: ActivityType.NOTE_ADDED,
      description: String(text),
      metadata: { source: 'cli' },
    },
  });

  await prisma.lead.update({
    where: { id },
    data: { lastActivityAt: new Date() },
  });

  return { activityId: activity.id };
}

// ---------------------------------------------------------------------------
// update-status
// ---------------------------------------------------------------------------

const VALID_STATUSES = [
  'CONTACTED',
  'SCHEDULED',
  'FOLLOW_UP',
  'CLOSED_INVESTED',
  'CLOSED_NOT_INVESTED',
];

/**
 * Update a lead's status and record a STATUS_CHANGED activity.
 * Note: this bypasses the strict allowedTransitions rules in leads.service.js —
 * it is an operator/agent escape hatch. The Claude skill must avoid invalid transitions.
 *
 * @param {{ id: string, status: string }} opts
 * @returns {Promise<{ lead: { id: string, status: string } }>}
 */
export async function updateStatus({ id, status }) {
  if (!id) throw Object.assign(new Error('id is required'), { code: 'MISSING_ID' });
  if (!status) throw Object.assign(new Error('--status is required'), { code: 'MISSING_STATUS' });

  const upperStatus = status.toUpperCase();
  if (!VALID_STATUSES.includes(upperStatus)) {
    throw Object.assign(
      new Error(`Invalid status "${status}". Valid values: ${VALID_STATUSES.join(', ')}`),
      { code: 'INVALID_STATUS' }
    );
  }

  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) throw Object.assign(new Error(`Lead ${id} not found`), { code: 'NOT_FOUND' });

  // Validate required fields before allowing transition to statuses that need them.
  // This mirrors the business rules enforced by leads.service.js in the HTTP layer.
  if (upperStatus === 'CLOSED_NOT_INVESTED' && !lead.noInvestmentReason) {
    throw Object.assign(
      new Error(
        'noInvestmentReason is required for CLOSED_NOT_INVESTED. Use leads update first to set it.'
      ),
      { code: 'MISSING_FIELD' }
    );
  }
  if (upperStatus === 'FOLLOW_UP' && !lead.nextActionDate) {
    throw Object.assign(
      new Error(
        'nextActionDate is required before setting FOLLOW_UP via CLI. Use leads reschedule first.'
      ),
      { code: 'MISSING_FIELD' }
    );
  }

  const updated = await prisma.lead.update({
    where: { id },
    data: { status: upperStatus, lastActivityAt: new Date() },
  });

  await prisma.activity.create({
    data: {
      leadId: id,
      userId: null,
      type: ActivityType.STATUS_CHANGED,
      description: `Estado cambiado de ${lead.status} a ${upperStatus} (CLI)`,
      metadata: { previousStatus: lead.status, newStatus: upperStatus, source: 'cli' },
    },
  });

  return { lead: { id: updated.id, status: updated.status } };
}

// ---------------------------------------------------------------------------
// reschedule
// ---------------------------------------------------------------------------

const MIN_DAYS = 7;

/**
 * Update nextActionDate for a FOLLOW_UP lead and record a LEAD_UPDATED activity.
 * Either `days` (number, ≥7) or `date` (YYYY-MM-DD, ≥7 days from today) must be provided.
 *
 * @param {{ id: string, days?: number, date?: string }} opts
 * @returns {Promise<{ lead: { id: string, nextActionDate: string } }>}
 */
export async function reschedule({ id, days, date }) {
  if (!id) throw Object.assign(new Error('id is required'), { code: 'MISSING_ID' });
  if (!days && !date) {
    throw Object.assign(new Error('Either --days or --date is required'), { code: 'MISSING_DATE' });
  }

  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) throw Object.assign(new Error(`Lead ${id} not found`), { code: 'NOT_FOUND' });

  let targetDate;
  if (days !== undefined) {
    const numDays = Number(days);
    if (!Number.isInteger(numDays) || numDays < MIN_DAYS) {
      throw Object.assign(
        new Error(`--days must be an integer >= ${MIN_DAYS}`),
        { code: 'INVALID_DAYS' }
      );
    }
    targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + numDays);
  } else {
    targetDate = new Date(date);
    if (isNaN(targetDate.getTime())) {
      throw Object.assign(
        new Error(`--date "${date}" is not a valid date (use YYYY-MM-DD)`),
        { code: 'INVALID_DATE' }
      );
    }
    const minDate = new Date();
    minDate.setDate(minDate.getDate() + MIN_DAYS);
    if (targetDate < minDate) {
      throw Object.assign(
        new Error(`--date must be at least ${MIN_DAYS} days from today`),
        { code: 'DATE_TOO_SOON' }
      );
    }
  }

  const updated = await prisma.lead.update({
    where: { id },
    data: { nextActionDate: targetDate, lastActivityAt: new Date() },
  });

  await prisma.activity.create({
    data: {
      leadId: id,
      userId: null,
      type: ActivityType.LEAD_UPDATED,
      description: `Próxima acción reprogramada a ${targetDate.toISOString().split('T')[0]} (CLI)`,
      metadata: {
        previousNextActionDate: lead.nextActionDate?.toISOString() ?? null,
        newNextActionDate: targetDate.toISOString(),
        source: 'cli',
      },
    },
  });

  return { lead: { id: updated.id, nextActionDate: updated.nextActionDate.toISOString() } };
}
