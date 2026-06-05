import { prisma, LeadStatus } from "@crm/database";
import { statusChangeTimelineLabelEs } from "../constants/lead-copy.es.js";
import {
  calendarDaysFromTodayStart,
  formatSpanishDayMonthYear,
  startOfLocalDay,
  toYmdLocal
} from "../utils/follow-up-date.js";
import { formatAgendaShortDate } from "./lead-agenda.service.js";

const OPEN_STATUSES = [
  LeadStatus.NEW,
  LeadStatus.CONTACTED,
  LeadStatus.SCHEDULED,
  LeadStatus.FOLLOW_UP
];

const STATUS_SCORE = {
  [LeadStatus.FOLLOW_UP]: 50,
  [LeadStatus.SCHEDULED]: 40,
  [LeadStatus.CONTACTED]: 20,
  [LeadStatus.NEW]: 10
};

const PRIORITY_LEAD_SELECT = {
  id: true,
  leadNumber: true,
  fullName: true,
  status: true,
  followUpCount: true,
  nextActionDate: true,
  lastActivityAt: true,
  serviceCategory: {
    select: { id: true, name: true, slug: true }
  }
};

function scoreNextActionDate(nextActionDate) {
  if (!nextActionDate) return 0;

  const dayOffset = calendarDaysFromTodayStart(startOfLocalDay(nextActionDate));
  if (dayOffset < 0) return 40;
  if (dayOffset === 0) return 30;
  if (dayOffset <= 7) return 20;
  return 10;
}

function hasRecentActivity(lastActivityAt, now = new Date()) {
  if (!lastActivityAt) return false;
  const todayStart = startOfLocalDay(now);
  const activityStart = startOfLocalDay(lastActivityAt);
  const msPerDay = 86400000;
  const daysAgo = Math.round((todayStart.getTime() - activityStart.getTime()) / msPerDay);
  return daysAgo >= 0 && daysAgo <= 7;
}

/** @param {object} lead */
export function computePriorityScore(lead, now = new Date()) {
  let score = STATUS_SCORE[lead.status] ?? 0;
  score += scoreNextActionDate(lead.nextActionDate);
  score += (lead.followUpCount ?? 0) * 5;

  if (hasRecentActivity(lead.lastActivityAt, now)) {
    score += 10;
  }

  return score;
}

export function resolvePriorityLevel(score) {
  if (score >= 90) return { level: "ALTA", label: "Alta" };
  if (score >= 60) return { level: "MEDIA", label: "Media" };
  return { level: "BAJA", label: "Baja" };
}

/** @param {object} lead */
export function buildPriorityReason(lead) {
  const status = lead.status;
  const nextActionDate = lead.nextActionDate;

  if (nextActionDate) {
    const dayOffset = calendarDaysFromTodayStart(startOfLocalDay(nextActionDate));
    const dateLabel = formatAgendaShortDate(nextActionDate);

    if (dayOffset < 0) {
      return `Seguimiento vencido desde ${dateLabel}.`;
    }
    if (dayOffset === 0) {
      if (status === LeadStatus.SCHEDULED) {
        return "Cita programada para hoy.";
      }
      return "Acción programada para hoy.";
    }
    if (status === LeadStatus.SCHEDULED) {
      return `Cita agendada para ${dateLabel}.`;
    }
    if (status === LeadStatus.FOLLOW_UP) {
      return `Seguimiento programado para ${dateLabel}.`;
    }
    return `Próxima acción el ${dateLabel}.`;
  }

  if (status === LeadStatus.FOLLOW_UP) {
    return "Lead en seguimiento.";
  }
  if (status === LeadStatus.SCHEDULED) {
    return "Lead agendado sin fecha de acción registrada.";
  }
  if (status === LeadStatus.CONTACTED) {
    return "Lead contactado pendiente de avance.";
  }
  if (status === LeadStatus.NEW) {
    return "Lead nuevo sin contactar.";
  }

  return "Lead abierto en pipeline.";
}

export function comparePriorityLeads(a, b) {
  if (b.priorityScore !== a.priorityScore) {
    return b.priorityScore - a.priorityScore;
  }

  const dateA = a.nextActionDate ? new Date(a.nextActionDate).getTime() : Number.MAX_SAFE_INTEGER;
  const dateB = b.nextActionDate ? new Date(b.nextActionDate).getTime() : Number.MAX_SAFE_INTEGER;
  if (dateA !== dateB) return dateA - dateB;

  const actA = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
  const actB = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
  return actB - actA;
}

function formatPriorityLeadItem(lead, now = new Date()) {
  const priorityScore = computePriorityScore(lead, now);
  const { level, label } = resolvePriorityLevel(priorityScore);
  const statusLabel = statusChangeTimelineLabelEs[lead.status] ?? lead.status;

  return {
    leadId: lead.id,
    leadNumber: lead.leadNumber,
    fullName: lead.fullName,
    status: lead.status,
    statusLabel,
    service: lead.serviceCategory?.name ?? null,
    followUpCount: lead.followUpCount ?? 0,
    priorityScore,
    priorityLevel: level,
    priorityLevelLabel: label,
    priorityReason: buildPriorityReason(lead),
    nextActionDate: lead.nextActionDate ? toYmdLocal(lead.nextActionDate) : null,
    nextActionDateLabel: lead.nextActionDate
      ? formatSpanishDayMonthYear(lead.nextActionDate)
      : null,
    lastActivityAt: lead.lastActivityAt
      ? lead.lastActivityAt instanceof Date
        ? lead.lastActivityAt.toISOString()
        : lead.lastActivityAt
      : null
  };
}

export function buildPriorityLeadsSummaryText(items) {
  if (items.length === 0) {
    return "No tienes leads abiertos para priorizar.";
  }

  const lines = ["Leads recomendados para atender:", ""];

  items.forEach((item, index) => {
    lines.push(`${index + 1}. ${item.fullName}`);
    lines.push(`   Prioridad: ${item.priorityLevelLabel}`);
    lines.push(`   Motivo: ${item.priorityReason}`);
    lines.push(`   Estado: ${item.statusLabel}.`);
    lines.push("");
  });

  return lines.join("\n").trimEnd();
}

export async function getPriorityLeads() {
  const now = new Date();

  const leads = await prisma.lead.findMany({
    where: { status: { in: OPEN_STATUSES } },
    select: PRIORITY_LEAD_SELECT
  });

  const items = leads
    .map((lead) => formatPriorityLeadItem(lead, now))
    .sort(comparePriorityLeads);

  return {
    action: "GET_PRIORITY_LEADS",
    count: items.length,
    leads: items,
    summaryText: buildPriorityLeadsSummaryText(items)
  };
}
