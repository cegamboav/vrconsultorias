import { prisma, LeadStatus } from "@crm/database";
import {
  followUpReasonLabelEs,
  statusChangeTimelineLabelEs
} from "../constants/lead-copy.es.js";
import {
  addDaysLocal,
  calendarDaysFromTodayStart,
  formatSpanishDayMonthYear,
  startOfLocalDay,
  toYmdLocal
} from "../utils/follow-up-date.js";

const CLOSED_STATUSES = [LeadStatus.CLOSED_SUCCESS, LeadStatus.CLOSED_LOST];

const AGENDA_LEAD_SELECT = {
  id: true,
  leadNumber: true,
  fullName: true,
  status: true,
  nextActionDate: true,
  serviceCategory: {
    select: { id: true, name: true, slug: true }
  }
};

const ACTIONABLE_LEAD_SELECT = {
  ...AGENDA_LEAD_SELECT,
  followUpReason: true,
  followUpCount: true,
  lastActivityAt: true
};

function openLeadWhere(extra = {}) {
  return {
    status: { notIn: CLOSED_STATUSES },
    ...extra
  };
}

function formatAgendaLeadItem(lead) {
  const nextActionDate = lead.nextActionDate;
  const dayOffset = calendarDaysFromTodayStart(startOfLocalDay(nextActionDate));
  const overdueDays = dayOffset < 0 ? Math.abs(dayOffset) : 0;

  return {
    leadNumber: lead.leadNumber,
    fullName: lead.fullName,
    status: lead.status,
    statusLabel: statusChangeTimelineLabelEs[lead.status] ?? lead.status,
    service: lead.serviceCategory?.name ?? null,
    nextActionDate: toYmdLocal(nextActionDate),
    nextActionDateLabel: formatSpanishDayMonthYear(nextActionDate),
    dueToday: dayOffset === 0,
    overdueDays
  };
}

/** Leads abiertos con próxima acción hoy o vencida (<= fin del día). */
export async function getTodayAgenda() {
  const tomorrowStart = addDaysLocal(startOfLocalDay(new Date()), 1);

  const leads = await prisma.lead.findMany({
    where: openLeadWhere({
      nextActionDate: { not: null, lt: tomorrowStart }
    }),
    orderBy: [{ nextActionDate: "asc" }, { leadNumber: "asc" }],
    select: AGENDA_LEAD_SELECT
  });

  const items = leads.map(formatAgendaLeadItem);

  return {
    count: items.length,
    leads: items,
    summaryText: buildTodayAgendaSummaryText(items)
  };
}

/** Leads abiertos con próxima acción programada para mañana. */
export async function getTomorrowAgenda() {
  const tomorrowStart = addDaysLocal(startOfLocalDay(new Date()), 1);
  const dayAfterTomorrowStart = addDaysLocal(tomorrowStart, 1);

  const leads = await prisma.lead.findMany({
    where: openLeadWhere({
      nextActionDate: { gte: tomorrowStart, lt: dayAfterTomorrowStart }
    }),
    orderBy: [{ nextActionDate: "asc" }, { leadNumber: "asc" }],
    select: AGENDA_LEAD_SELECT
  });

  const items = leads.map(formatAgendaLeadItem);

  return {
    count: items.length,
    leads: items,
    summaryText: buildTomorrowAgendaSummaryText(items)
  };
}

/** Seguimientos FOLLOW_UP estrictamente vencidos (fecha anterior a hoy). */
export async function getOverdueFollowups() {
  const todayStart = startOfLocalDay(new Date());

  const leads = await prisma.lead.findMany({
    where: {
      status: LeadStatus.FOLLOW_UP,
      nextActionDate: { not: null, lt: todayStart }
    },
    orderBy: [{ nextActionDate: "asc" }, { leadNumber: "asc" }],
    select: AGENDA_LEAD_SELECT
  });

  const items = leads.map(formatAgendaLeadItem);

  return {
    count: items.length,
    leads: items,
    summaryText: buildOverdueFollowupsSummaryText(items)
  };
}

/** Próximos leads abiertos con fecha de acción, más urgentes primero. */
export async function getNextLeadsToAttend({ limit = 3 } = {}) {
  const take = Math.min(Math.max(Number(limit) || 3, 1), 10);

  const leads = await prisma.lead.findMany({
    where: openLeadWhere({
      nextActionDate: { not: null }
    }),
    orderBy: [{ nextActionDate: "asc" }, { leadNumber: "asc" }],
    take,
    select: AGENDA_LEAD_SELECT
  });

  return leads.map(formatAgendaLeadItem);
}

export function buildTodayAgendaSummaryText(items) {
  if (items.length === 0) {
    return "No tienes acciones pendientes para hoy.";
  }

  const noun = items.length === 1 ? "acción pendiente" : "acciones pendientes";
  const lines = [`Tienes ${items.length} ${noun}:`, ""];

  items.forEach((item, index) => {
    lines.push(`${index + 1}. ${item.fullName} (${item.statusLabel})`);
    if (item.overdueDays > 0) {
      const daysLabel = item.overdueDays === 1 ? "día" : "días";
      lines.push(`   Atrasado por ${item.overdueDays} ${daysLabel}`);
    }
    lines.push("");
  });

  return lines.join("\n").trimEnd();
}

export function buildTomorrowAgendaSummaryText(items) {
  if (items.length === 0) {
    return "No tienes acciones programadas para mañana.";
  }

  const noun = items.length === 1 ? "acción programada" : "acciones programadas";
  const lines = [`Tienes ${items.length} ${noun} para mañana:`, ""];

  items.forEach((item, index) => {
    const serviceSuffix = item.service ? ` (${item.service})` : "";
    lines.push(`${index + 1}. ${item.fullName}${serviceSuffix}`);
    lines.push("");
  });

  return lines.join("\n").trimEnd();
}

export function buildOverdueFollowupsSummaryText(items) {
  if (items.length === 0) {
    return "No tienes seguimientos atrasados.";
  }

  const noun = items.length === 1 ? "seguimiento atrasado" : "seguimientos atrasados";
  const lines = [`Tienes ${items.length} ${noun}:`, ""];

  items.forEach((item, index) => {
    const serviceSuffix = item.service ? ` (${item.service})` : "";
    const daysLabel = item.overdueDays === 1 ? "día" : "días";
    lines.push(
      `${index + 1}. ${item.fullName}${serviceSuffix} (${item.overdueDays} ${daysLabel} de atraso)`
    );
    lines.push("");
  });

  return lines.join("\n").trimEnd();
}

/** Fecha corta para agrupación de agenda (ej. 30 jun). */
export function formatAgendaShortDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  return d
    .toLocaleDateString("es-CR", { day: "numeric", month: "short" })
    .replace(/\./g, "");
}

function formatNextActionUrgencyLabel(nextActionDate) {
  const dayOffset = calendarDaysFromTodayStart(startOfLocalDay(nextActionDate));
  if (dayOffset === 0) return "Hoy";
  if (dayOffset < 0) {
    const days = Math.abs(dayOffset);
    return days === 1 ? "Atrasada (1 día)" : `Atrasada (${days} días)`;
  }
  return formatAgendaShortDate(nextActionDate);
}

export function compareActionableLeads(a, b) {
  const dateA = a.nextActionDate?.getTime() ?? 0;
  const dateB = b.nextActionDate?.getTime() ?? 0;
  if (dateA !== dateB) return dateA - dateB;

  const countDiff = (b.followUpCount ?? 0) - (a.followUpCount ?? 0);
  if (countDiff !== 0) return countDiff;

  const actA = a.lastActivityAt ? a.lastActivityAt.getTime() : 0;
  const actB = b.lastActivityAt ? b.lastActivityAt.getTime() : 0;
  return actB - actA;
}

function formatActionableLeadItem(lead) {
  const nextActionDate = lead.nextActionDate;
  const dayOffset = calendarDaysFromTodayStart(startOfLocalDay(nextActionDate));

  return {
    leadNumber: lead.leadNumber,
    fullName: lead.fullName,
    status: lead.status,
    statusLabel: statusChangeTimelineLabelEs[lead.status] ?? lead.status,
    service: lead.serviceCategory?.name ?? null,
    followUpReason: lead.followUpReason ?? null,
    followUpReasonLabel: lead.followUpReason
      ? followUpReasonLabelEs[lead.followUpReason] ?? lead.followUpReason
      : null,
    followUpCount: lead.followUpCount ?? 0,
    nextActionDate: toYmdLocal(nextActionDate),
    nextActionDateLabel: formatSpanishDayMonthYear(nextActionDate),
    nextActionUrgencyLabel: formatNextActionUrgencyLabel(nextActionDate),
    dueToday: dayOffset === 0,
    overdueDays: dayOffset < 0 ? Math.abs(dayOffset) : 0,
    lastActivityAt: lead.lastActivityAt
      ? lead.lastActivityAt instanceof Date
        ? lead.lastActivityAt.toISOString()
        : lead.lastActivityAt
      : null
  };
}

function formatUpcomingFollowupItem(lead) {
  const nextActionDate = lead.nextActionDate;
  return {
    ...formatActionableLeadItem(lead),
    groupDateLabel: formatAgendaShortDate(nextActionDate)
  };
}

/** Seguimientos FOLLOW_UP con próxima acción hoy o vencida. */
export async function getActionableLeads() {
  const tomorrowStart = addDaysLocal(startOfLocalDay(new Date()), 1);

  const leads = await prisma.lead.findMany({
    where: {
      status: LeadStatus.FOLLOW_UP,
      nextActionDate: { not: null, lt: tomorrowStart }
    },
    select: ACTIONABLE_LEAD_SELECT
  });

  const items = [...leads].sort(compareActionableLeads).map(formatActionableLeadItem);

  return {
    action: "GET_ACTIONABLE_LEADS",
    count: items.length,
    leads: items,
    summaryText: buildActionableLeadsSummaryText(items)
  };
}

/**
 * @param {{ rangeStart: Date, rangeEndExclusive: Date }} params
 */
export async function getUpcomingFollowups({ rangeStart, rangeEndExclusive }) {
  const leads = await prisma.lead.findMany({
    where: {
      status: LeadStatus.FOLLOW_UP,
      nextActionDate: { gte: rangeStart, lt: rangeEndExclusive }
    },
    orderBy: [{ nextActionDate: "asc" }, { leadNumber: "asc" }],
    select: ACTIONABLE_LEAD_SELECT
  });

  const items = leads.map(formatUpcomingFollowupItem);

  return {
    action: "GET_UPCOMING_FOLLOWUPS",
    count: items.length,
    leads: items,
    rangeStart: toYmdLocal(rangeStart),
    rangeEnd: toYmdLocal(addDaysLocal(rangeEndExclusive, -1)),
    summaryText: buildUpcomingFollowupsSummaryText(items)
  };
}

/**
 * @param {string} [message]
 * @param {{ daysAhead?: number }} [interpretation]
 */
export function resolveUpcomingFollowupsRange(message, interpretation = {}) {
  const todayStart = startOfLocalDay(new Date());
  const text = String(message ?? "").toLowerCase();

  if (/\bmañana\b/.test(text)) {
    const tomorrowStart = addDaysLocal(todayStart, 1);
    return {
      rangeStart: tomorrowStart,
      rangeEndExclusive: addDaysLocal(tomorrowStart, 1),
      scope: "TOMORROW"
    };
  }

  const daysAhead = Math.min(Math.max(Number(interpretation.daysAhead) || 7, 1), 30);
  return {
    rangeStart: todayStart,
    rangeEndExclusive: addDaysLocal(todayStart, daysAhead + 1),
    scope: daysAhead === 7 ? "NEXT_7_DAYS" : `NEXT_${daysAhead}_DAYS`
  };
}

export function buildActionableLeadsSummaryText(items) {
  if (items.length === 0) {
    return "No tienes acciones pendientes de seguimiento para hoy.";
  }

  const noun = items.length === 1 ? "acción pendiente" : "acciones pendientes";
  const lines = [`Tienes ${items.length} ${noun}:`, ""];

  items.forEach((item, index) => {
    lines.push(`${index + 1}. ${item.fullName}`);
    if (item.followUpReasonLabel) {
      lines.push(`   Motivo: ${item.followUpReasonLabel}`);
    }
    lines.push(`   Próxima acción: ${item.nextActionUrgencyLabel}`);
    lines.push("");
  });

  return lines.join("\n").trimEnd();
}

export function buildUpcomingFollowupsSummaryText(items) {
  if (items.length === 0) {
    return "No tienes seguimientos programados en ese periodo.";
  }

  const lines = ["Próximos seguimientos:", ""];

  const groups = new Map();
  for (const item of items) {
    const key = item.groupDateLabel ?? item.nextActionDate;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }

  for (const [dateLabel, groupLeads] of groups) {
    lines.push(dateLabel);
    for (const lead of groupLeads) {
      lines.push(`- ${lead.fullName}`);
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}
