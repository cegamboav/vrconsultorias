import { prisma, LeadStatus } from "@crm/database";
import { AppError } from "../utils/app-error.js";
import { statusChangeTimelineLabelEs } from "../constants/lead-copy.es.js";
import {
  addDaysLocal,
  formatSpanishDayMonthYear,
  startOfLocalDay,
  toYmdLocal
} from "../utils/follow-up-date.js";

const LEAD_INSIGHT_SELECT = {
  id: true,
  leadNumber: true,
  fullName: true,
  phone: true,
  email: true,
  status: true,
  followUpReason: true,
  followUpCount: true,
  nextActionDate: true,
  createdAt: true,
  serviceCategory: {
    select: { id: true, name: true, slug: true, color: true }
  }
};

const ALL_STATUSES = Object.values(LeadStatus);

function ensureLeadRow(lead) {
  if (!lead) throw new AppError("Lead no encontrado.", 404);
  return lead;
}

export function formatLeadStatusSnapshot(lead) {
  return {
    fullName: lead.fullName,
    status: lead.status,
    statusLabel: statusChangeTimelineLabelEs[lead.status] ?? lead.status,
    service: lead.serviceCategory?.name ?? null,
    nextActionDate: lead.nextActionDate ? toYmdLocal(lead.nextActionDate) : null,
    nextActionDateLabel: lead.nextActionDate
      ? formatSpanishDayMonthYear(lead.nextActionDate)
      : null
  };
}

export function formatLeadDetailsSnapshot(lead) {
  return {
    leadNumber: lead.leadNumber,
    fullName: lead.fullName,
    phone: lead.phone,
    email: lead.email ?? null,
    service: lead.serviceCategory?.name ?? null,
    status: lead.status,
    statusLabel: statusChangeTimelineLabelEs[lead.status] ?? lead.status,
    followUpCount: lead.followUpCount ?? 0,
    nextActionDate: lead.nextActionDate ? toYmdLocal(lead.nextActionDate) : null,
    nextActionDateLabel: lead.nextActionDate
      ? formatSpanishDayMonthYear(lead.nextActionDate)
      : null,
    createdAt: lead.createdAt instanceof Date ? lead.createdAt.toISOString() : lead.createdAt
  };
}

function formatPendingFollowUpItem(lead) {
  return {
    leadNumber: lead.leadNumber,
    fullName: lead.fullName,
    phone: lead.phone,
    status: lead.status,
    statusLabel: statusChangeTimelineLabelEs[lead.status] ?? lead.status,
    service: lead.serviceCategory?.name ?? null,
    followUpReason: lead.followUpReason ?? null,
    nextActionDate: lead.nextActionDate ? toYmdLocal(lead.nextActionDate) : null,
    nextActionDateLabel: lead.nextActionDate
      ? formatSpanishDayMonthYear(lead.nextActionDate)
      : null
  };
}

function formatUncontactedLeadItem(lead) {
  return {
    leadNumber: lead.leadNumber,
    fullName: lead.fullName,
    phone: lead.phone,
    service: lead.serviceCategory?.name ?? null,
    status: lead.status,
    statusLabel: statusChangeTimelineLabelEs[lead.status] ?? lead.status,
    createdAt: lead.createdAt instanceof Date ? lead.createdAt.toISOString() : lead.createdAt,
    createdAtLabel: lead.createdAt
      ? formatSpanishDayMonthYear(lead.createdAt)
      : null
  };
}

export async function getLeadStatusById(leadId) {
  const lead = ensureLeadRow(
    await prisma.lead.findUnique({
      where: { id: leadId },
      select: LEAD_INSIGHT_SELECT
    })
  );
  return formatLeadStatusSnapshot(lead);
}

export async function getLeadDetailsById(leadId) {
  const lead = ensureLeadRow(
    await prisma.lead.findUnique({
      where: { id: leadId },
      select: LEAD_INSIGHT_SELECT
    })
  );
  return formatLeadDetailsSnapshot(lead);
}

export async function countLeadsByStatus() {
  const grouped = await prisma.lead.groupBy({
    by: ["status"],
    _count: { _all: true }
  });

  const byStatus = Object.fromEntries(ALL_STATUSES.map((s) => [s, 0]));
  const byStatusLabel = Object.fromEntries(
    ALL_STATUSES.map((s) => [s, statusChangeTimelineLabelEs[s] ?? s])
  );

  let total = 0;
  for (const row of grouped) {
    const count = row._count._all ?? 0;
    byStatus[row.status] = count;
    total += count;
  }

  const summary = ALL_STATUSES.map((status) => ({
    status,
    statusLabel: byStatusLabel[status],
    count: byStatus[status]
  }));

  return { total, byStatus, summary };
}

/**
 * @param {string[]} statuses
 */
export async function countLeadsForStatuses(statuses) {
  const list = (statuses ?? []).filter(Boolean);
  if (list.length === 0) {
    return { count: 0, statuses: [] };
  }

  const count = await prisma.lead.count({
    where: { status: { in: list } }
  });

  return { count, statuses: list };
}

/**
 * @param {string[]} statuses
 * @param {{ limit?: number }} [options]
 */
export async function listLeadsForStatuses(statuses, { limit = 50 } = {}) {
  const list = (statuses ?? []).filter(Boolean);
  if (list.length === 0) {
    return { count: 0, leads: [], statuses: [] };
  }

  const take = Math.min(Math.max(Number(limit) || 50, 1), 100);

  const rows = await prisma.lead.findMany({
    where: { status: { in: list } },
    orderBy: [{ leadNumber: "asc" }],
    take,
    select: {
      id: true,
      leadNumber: true,
      fullName: true,
      status: true
    }
  });

  return {
    count: rows.length,
    leads: rows.map((lead) => ({
      leadNumber: lead.leadNumber,
      fullName: lead.fullName,
      status: lead.status,
      statusLabel: statusChangeTimelineLabelEs[lead.status] ?? lead.status
    })),
    statuses: list
  };
}

/** Seguimientos con fecha de próxima acción hoy o vencida. */
export async function getPendingFollowUpsDueToday() {
  const tomorrowStart = addDaysLocal(startOfLocalDay(new Date()), 1);

  const leads = await prisma.lead.findMany({
    where: {
      status: LeadStatus.FOLLOW_UP,
      nextActionDate: { not: null, lt: tomorrowStart }
    },
    orderBy: [{ nextActionDate: "asc" }, { leadNumber: "asc" }],
    select: LEAD_INSIGHT_SELECT
  });

  return {
    count: leads.length,
    leads: leads.map(formatPendingFollowUpItem)
  };
}

/** Leads en estado NEW sin primer contacto, más antiguos primero. */
export async function getOldestUncontactedLeads({ limit = 10 } = {}) {
  const take = Math.min(Math.max(Number(limit) || 10, 1), 10);

  const leads = await prisma.lead.findMany({
    where: { status: LeadStatus.NEW },
    orderBy: [{ createdAt: "asc" }, { leadNumber: "asc" }],
    take,
    select: LEAD_INSIGHT_SELECT
  });

  return {
    count: leads.length,
    leads: leads.map(formatUncontactedLeadItem)
  };
}
