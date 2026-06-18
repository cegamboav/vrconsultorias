import { prisma, ActivityType, LeadStatus } from "@crm/database";
import { followUpReasonLabelEs } from "../constants/lead-copy.es.js";
import { addDaysLocal, startOfLocalDay, toYmdLocal } from "../utils/follow-up-date.js";
import { getOverdueFollowups, getUpcomingFollowups } from "./lead-agenda.service.js";

const OPEN_STATUSES = [
  LeadStatus.NEW,
  LeadStatus.CONTACTED,
  LeadStatus.SCHEDULED,
  LeadStatus.FOLLOW_UP
];

/** Período de 7 días calendario incluyendo hoy. */
export function resolveWeeklySummaryPeriod(now = new Date()) {
  const todayStart = startOfLocalDay(now);
  const periodStart = addDaysLocal(todayStart, -6);
  const periodEndExclusive = addDaysLocal(todayStart, 1);
  return {
    periodStart,
    periodEndExclusive,
    periodStartLabel: toYmdLocal(periodStart),
    periodEndLabel: toYmdLocal(todayStart)
  };
}

function createdAtInPeriod(period) {
  return {
    gte: period.periodStart,
    lt: period.periodEndExclusive
  };
}

async function countFollowUpsScheduledInPeriod(period) {
  return prisma.activity.count({
    where: {
      type: ActivityType.STATUS_CHANGED,
      createdAt: createdAtInPeriod(period),
      metadata: { path: ["to"], equals: LeadStatus.FOLLOW_UP }
    }
  });
}

async function countTopServicesInPeriod(period) {
  const rows = await prisma.lead.groupBy({
    by: ["serviceCategoryId"],
    where: { createdAt: createdAtInPeriod(period) },
    _count: { _all: true }
  });

  if (rows.length === 0) return [];

  const sorted = [...rows].sort((a, b) => b._count._all - a._count._all).slice(0, 5);

  const categories = await prisma.serviceCategory.findMany({
    where: { id: { in: rows.map((r) => r.serviceCategoryId) } },
    select: { id: true, name: true }
  });

  const nameById = Object.fromEntries(categories.map((c) => [c.id, c.name]));

  return sorted.map((row, index) => ({
    rank: index + 1,
    serviceCategoryId: row.serviceCategoryId,
    serviceName: nameById[row.serviceCategoryId] ?? "Sin servicio",
    count: row._count._all
  }));
}

async function countOpenLeadsByStatus() {
  const rows = await prisma.lead.groupBy({
    by: ["status"],
    where: { status: { in: OPEN_STATUSES } },
    _count: { _all: true }
  });

  const byStatus = Object.fromEntries(OPEN_STATUSES.map((s) => [s, 0]));
  for (const row of rows) {
    byStatus[row.status] = row._count._all;
  }
  return byStatus;
}

async function topFollowUpReasonAmongOpen() {
  const rows = await prisma.lead.groupBy({
    by: ["followUpReason"],
    where: {
      status: LeadStatus.FOLLOW_UP,
      followUpReason: { not: null }
    },
    _count: { _all: true }
  });

  if (rows.length === 0) return null;

  const top = [...rows].sort((a, b) => b._count._all - a._count._all)[0];
  const reason = top.followUpReason;
  return {
    reason,
    label: followUpReasonLabelEs[reason] ?? reason,
    count: top._count._all
  };
}

/**
 * @param {object} params
 */
export function buildWeeklyObservations({
  metrics,
  activities,
  services,
  openByStatus,
  topFollowUpReason
}) {
  const observations = [];

  const openTotal = OPEN_STATUSES.reduce((sum, status) => sum + (openByStatus[status] ?? 0), 0);
  const followUpOpen = openByStatus[LeadStatus.FOLLOW_UP] ?? 0;

  if (openTotal > 0 && followUpOpen / openTotal >= 0.5) {
    observations.push("La mayoría de los leads abiertos están en seguimiento.");
  }

  if (topFollowUpReason?.label) {
    observations.push(
      `El principal motivo de seguimiento es ${topFollowUpReason.label.toLowerCase()}.`
    );
  }

  if (services.length > 0) {
    observations.push(
      `${services[0].serviceName} es actualmente el servicio más solicitado en la semana.`
    );
  }

  if (metrics.leadsCreated === 0 && (activities?.notesAdded ?? 0) === 0) {
    observations.push("La actividad comercial registrada esta semana es baja.");
  }

  if (metrics.leadsClosedSuccess > 0 && metrics.leadsClosedSuccess >= metrics.leadsLost) {
    observations.push("Se registraron más cierres exitosos que leads perdidos en el periodo.");
  }

  if (metrics.leadsSentToFollowUp > metrics.leadsClosedSuccess && metrics.leadsSentToFollowUp > 0) {
    observations.push("Varios leads pasaron a seguimiento durante la semana.");
  }

  if (observations.length === 0) {
    observations.push("No hay observaciones destacadas para este periodo.");
  }

  return observations;
}

/**
 * @param {object} summary
 */
export function formatWeeklyBusinessSummaryText(summary) {
  const { metrics, services, activities, pending, observations } = summary;
  const lines = ["Resumen comercial semanal", ""];

  lines.push(`Leads creados: ${metrics.leadsCreated}`);
  lines.push(`Leads concretados: ${metrics.leadsClosedSuccess}`);
  lines.push(`Leads perdidos: ${metrics.leadsLost}`);
  lines.push(`Leads en seguimiento: ${metrics.leadsSentToFollowUp}`);
  lines.push("");

  lines.push("Servicios más solicitados:");
  if (services.length === 0) {
    lines.push("(Sin leads nuevos en el periodo)");
  } else {
    for (const service of services) {
      lines.push(`${service.rank}. ${service.serviceName} (${service.count})`);
    }
  }
  lines.push("");

  lines.push("Actividad comercial:");
  lines.push(`• Notas agregadas: ${activities.notesAdded}`);
  lines.push(`• Cambios de estado: ${activities.statusChanges}`);
  lines.push(`• Seguimientos programados: ${activities.followUpsScheduled}`);
  lines.push("");

  lines.push("Pendientes:");
  lines.push(`• Seguimientos vencidos: ${pending.overdueFollowups}`);
  lines.push(
    `• Seguimientos próximos 7 días: ${pending.upcomingFollowups}`
  );
  lines.push("");

  lines.push("Observaciones:");
  for (const observation of observations) {
    lines.push(`• ${observation}`);
  }

  return lines.join("\n").trim();
}

export async function getWeeklyBusinessSummary(now = new Date()) {
  const period = resolveWeeklySummaryPeriod(now);
  const createdAtFilter = createdAtInPeriod(period);

  const [
    leadsCreated,
    leadsClosedSuccess,
    leadsLost,
    leadsSentToFollowUp,
    notesAdded,
    statusChanges,
    followUpsScheduled,
    services,
    openByStatus,
    topFollowUpReason,
    overdue,
    upcoming
  ] = await Promise.all([
    prisma.lead.count({ where: { createdAt: createdAtFilter } }),
    prisma.lead.count({
      where: {
        status: LeadStatus.CLOSED_SUCCESS,
        closedAt: createdAtFilter
      }
    }),
    prisma.lead.count({
      where: {
        status: LeadStatus.CLOSED_LOST,
        closedAt: createdAtFilter
      }
    }),
    countFollowUpsScheduledInPeriod(period),
    prisma.activity.count({
      where: { type: ActivityType.NOTE_ADDED, createdAt: createdAtFilter }
    }),
    prisma.activity.count({
      where: { type: ActivityType.STATUS_CHANGED, createdAt: createdAtFilter }
    }),
    countFollowUpsScheduledInPeriod(period),
    countTopServicesInPeriod(period),
    countOpenLeadsByStatus(),
    topFollowUpReasonAmongOpen(),
    getOverdueFollowups(),
    getUpcomingFollowups({
      rangeStart: startOfLocalDay(now),
      rangeEndExclusive: addDaysLocal(startOfLocalDay(now), 8)
    })
  ]);

  const metrics = {
    leadsCreated,
    leadsClosedSuccess,
    leadsLost,
    leadsSentToFollowUp
  };

  const activities = {
    notesAdded,
    statusChanges,
    followUpsScheduled
  };

  const pending = {
    overdueFollowups: overdue.count,
    overdueLeads: overdue.leads.map((l) => ({
      leadNumber: l.leadNumber,
      fullName: l.fullName,
      nextActionDate: l.nextActionDate
    })),
    upcomingFollowups: upcoming.count,
    upcomingLeads: upcoming.leads.map((l) => ({
      leadNumber: l.leadNumber,
      fullName: l.fullName,
      nextActionDate: l.nextActionDate,
      groupDateLabel: l.groupDateLabel
    }))
  };

  const observations = buildWeeklyObservations({
    metrics,
    activities,
    services,
    openByStatus,
    topFollowUpReason
  });

  const summary = {
    action: "GET_WEEKLY_BUSINESS_SUMMARY",
    period: {
      start: period.periodStartLabel,
      end: period.periodEndLabel,
      days: 7
    },
    metrics,
    services,
    activities,
    pending,
    observations
  };

  summary.summaryText = formatWeeklyBusinessSummaryText(summary);

  return summary;
}
