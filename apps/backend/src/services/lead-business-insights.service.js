import { prisma, LeadStatus } from "@crm/database";
import { followUpReasonLabelEs } from "../constants/lead-copy.es.js";
import { addDaysLocal, startOfLocalDay, toYmdLocal } from "../utils/follow-up-date.js";
import { getOverdueFollowups } from "./lead-agenda.service.js";

const OPEN_STATUSES = [
  LeadStatus.NEW,
  LeadStatus.CONTACTED,
  LeadStatus.SCHEDULED,
  LeadStatus.FOLLOW_UP
];

const SEVERITY_ORDER = { WARNING: 0, POSITIVE: 1, INFO: 2 };

const FOLLOW_UP_REASON_MESSAGES = {
  NO_MONEY: "La mayoría de los seguimientos están relacionados con falta de liquidez.",
  THINKING:
    "La mayoría de los seguimientos corresponden a clientes que desean analizar la propuesta.",
  NO_RESPONSE:
    "La mayoría de los seguimientos se deben a leads que no responden al contacto.",
  CALL_LATER:
    "La mayoría de los seguimientos están programados para retomar contacto más adelante.",
  BUSY: "La mayoría de los seguimientos corresponden a clientes ocupados temporalmente.",
  OTHER: "La mayoría de los seguimientos tienen motivos variados u otros."
};

/** Período de 30 días calendario incluyendo hoy. */
export function resolveInsightsPeriod(now = new Date()) {
  const todayStart = startOfLocalDay(now);
  const periodStart = addDaysLocal(todayStart, -29);
  const periodEndExclusive = addDaysLocal(todayStart, 1);
  return {
    days: 30,
    periodStart,
    periodEndExclusive,
    periodStartLabel: toYmdLocal(periodStart),
    periodEndLabel: toYmdLocal(todayStart)
  };
}

function dateInPeriod(period) {
  return {
    gte: period.periodStart,
    lt: period.periodEndExclusive
  };
}

/**
 * @param {Array<{ type: string, severity: string, message: string }>} insights
 */
export function sortBusinessInsights(insights) {
  return [...insights].sort(
    (a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9)
  );
}

function dominantFollowUpReasonMessage(reason, label) {
  if (FOLLOW_UP_REASON_MESSAGES[reason]) {
    return FOLLOW_UP_REASON_MESSAGES[reason];
  }
  return `La mayoría de los seguimientos están relacionados con ${label.toLowerCase()}.`;
}

/**
 * @param {object} data
 */
export function buildBusinessInsightsFromData(data) {
  const insights = [];

  if (data.topServiceConcentration?.share >= 0.6) {
    const { serviceName, share, count, totalCreated } = data.topServiceConcentration;
    const pct = Math.round(share * 100);
    insights.push({
      type: "SERVICE_CONCENTRATION",
      severity: share >= 0.75 ? "WARNING" : "INFO",
      message:
        share >= 0.75
          ? `${serviceName} representa el ${pct}% de los nuevos leads creados en el último mes.`
          : `El negocio depende principalmente del servicio ${serviceName} (${pct}% de ${totalCreated} leads nuevos).`
    });
  }

  if (data.dominantFollowUpReason) {
    const { reason, label, share } = data.dominantFollowUpReason;
    if (share >= 0.5) {
      insights.push({
        type: "FOLLOW_UP_REASON",
        severity: reason === "NO_MONEY" ? "WARNING" : "INFO",
        message: dominantFollowUpReasonMessage(reason, label)
      });
    }
  }

  if (data.openLeadsTotal > 0 && data.openLeadsTotal <= 5) {
    if (data.followUpOpenCount > 0 && data.followUpOpenCount <= 2) {
      const noun =
        data.followUpOpenCount === 1 ? "un lead en seguimiento" : "dos leads en seguimiento";
      insights.push({
        type: "PIPELINE_RISK",
        severity: "WARNING",
        message: `La cartera activa depende principalmente de ${noun}.`
      });
    } else {
      insights.push({
        type: "PIPELINE_RISK",
        severity: "WARNING",
        message: "La cartera activa es reducida y depende de pocos leads."
      });
    }
  }

  if (data.overdueFollowups > 0) {
    const noun = data.overdueFollowups === 1 ? "seguimiento atrasado" : "seguimientos atrasados";
    insights.push({
      type: "OVERDUE_FOLLOWUPS",
      severity: "WARNING",
      message: `Existen ${data.overdueFollowups} ${noun} que requieren atención.`
    });
  } else if (data.followUpOpenCount > 0) {
    insights.push({
      type: "OVERDUE_FOLLOWUPS",
      severity: "POSITIVE",
      message: "No existen seguimientos vencidos actualmente."
    });
  }

  if (
    data.leadsClosedInPeriod > 0 &&
    data.leadsCreatedInPeriod < data.leadsClosedInPeriod
  ) {
    insights.push({
      type: "LEAD_GENERATION",
      severity: "WARNING",
      message:
        "La generación de nuevos leads es baja comparada con los cierres recientes."
    });
  }

  if (data.leadsClosedSuccessInPeriod > data.leadsClosedLostInPeriod && data.leadsClosedSuccessInPeriod > 0) {
    insights.push({
      type: "CLOSING_RATE",
      severity: "POSITIVE",
      message: "La tasa de cierre reciente es favorable."
    });
  } else if (
    data.leadsClosedLostInPeriod > data.leadsClosedSuccessInPeriod &&
    data.leadsClosedLostInPeriod > 0
  ) {
    insights.push({
      type: "CLOSING_RATE",
      severity: "WARNING",
      message: `Se registraron más leads perdidos (${data.leadsClosedLostInPeriod}) que concretados (${data.leadsClosedSuccessInPeriod}) en el último mes.`
    });
  }

  if (data.inactiveOpenLeads > 0) {
    const noun = data.inactiveOpenLeads === 1 ? "lead abierto" : "leads abiertos";
    insights.push({
      type: "INACTIVITY",
      severity: "WARNING",
      message: `Existen ${data.inactiveOpenLeads} ${noun} sin actividad reciente que podrían requerir seguimiento.`
    });
  }

  if (data.leadsClosedLostInPeriod > 0 && data.topLostReason) {
    insights.push({
      type: "LOST_LEADS",
      severity: "INFO",
      message: `Entre los leads no concretados, el motivo más frecuente es: ${data.topLostReason}.`
    });
  }

  if (insights.length === 0) {
    insights.push({
      type: "GENERAL",
      severity: "INFO",
      message: "No se detectaron patrones destacados en el último mes con los datos actuales."
    });
  }

  return sortBusinessInsights(insights);
}

/**
 * @param {Array<{ message: string }>} insights
 */
export function formatBusinessInsightsText(insights) {
  if (insights.length === 0) {
    return "Insights del negocio\n\nNo hay observaciones disponibles.";
  }

  const lines = ["Insights del negocio", ""];
  insights.forEach((insight, index) => {
    lines.push(`${index + 1}. ${insight.message}`);
  });
  return lines.join("\n").trim();
}

export async function gatherBusinessInsightData(period, now) {
  const dateFilter = dateInPeriod(period);
  const inactivityThreshold = addDaysLocal(startOfLocalDay(now), -14);

  const [
    leadsCreatedInPeriod,
    leadsClosedSuccessInPeriod,
    leadsClosedLostInPeriod,
    openLeadsTotal,
    followUpOpenCount,
    serviceRows,
    followUpReasonRows,
    inactiveOpenLeads,
    lostLeadsInPeriod,
    overdue
  ] = await Promise.all([
    prisma.lead.count({ where: { createdAt: dateFilter } }),
    prisma.lead.count({
      where: { status: LeadStatus.CLOSED_SUCCESS, closedAt: dateFilter }
    }),
    prisma.lead.count({
      where: { status: LeadStatus.CLOSED_LOST, closedAt: dateFilter }
    }),
    prisma.lead.count({ where: { status: { in: OPEN_STATUSES } } }),
    prisma.lead.count({ where: { status: LeadStatus.FOLLOW_UP } }),
    prisma.lead.groupBy({
      by: ["serviceCategoryId"],
      where: { createdAt: dateFilter },
      _count: { _all: true }
    }),
    prisma.lead.groupBy({
      by: ["followUpReason"],
      where: { status: LeadStatus.FOLLOW_UP, followUpReason: { not: null } },
      _count: { _all: true }
    }),
    prisma.lead.count({
      where: {
        status: { in: OPEN_STATUSES },
        OR: [
          { lastActivityAt: null },
          { lastActivityAt: { lt: inactivityThreshold } }
        ]
      }
    }),
    prisma.lead.findMany({
      where: {
        status: LeadStatus.CLOSED_LOST,
        closedAt: dateFilter,
        noInvestmentReason: { not: null }
      },
      select: { noInvestmentReason: true }
    }),
    getOverdueFollowups()
  ]);

  let topServiceConcentration = null;
  if (leadsCreatedInPeriod > 0 && serviceRows.length > 0) {
    const sorted = [...serviceRows].sort((a, b) => b._count._all - a._count._all);
    const top = sorted[0];
    const categories = await prisma.serviceCategory.findMany({
      where: { id: { in: sorted.map((r) => r.serviceCategoryId) } },
      select: { id: true, name: true }
    });
    const nameById = Object.fromEntries(categories.map((c) => [c.id, c.name]));
    topServiceConcentration = {
      serviceName: nameById[top.serviceCategoryId] ?? "Sin servicio",
      count: top._count._all,
      totalCreated: leadsCreatedInPeriod,
      share: top._count._all / leadsCreatedInPeriod
    };
  }

  let dominantFollowUpReason = null;
  if (followUpReasonRows.length > 0) {
    const sorted = [...followUpReasonRows].sort((a, b) => b._count._all - a._count._all);
    const top = sorted[0];
    const total = sorted.reduce((sum, row) => sum + row._count._all, 0);
    const reason = top.followUpReason;
    dominantFollowUpReason = {
      reason,
      label: followUpReasonLabelEs[reason] ?? reason,
      count: top._count._all,
      total,
      share: top._count._all / total
    };
  }

  let topLostReason = null;
  if (lostLeadsInPeriod.length > 0) {
    const counts = new Map();
    for (const row of lostLeadsInPeriod) {
      const text = String(row.noInvestmentReason ?? "").trim();
      if (!text) continue;
      counts.set(text, (counts.get(text) ?? 0) + 1);
    }
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    if (sorted.length > 0) {
      topLostReason = sorted[0][0];
    }
  }

  return {
    leadsCreatedInPeriod,
    leadsClosedSuccessInPeriod,
    leadsClosedLostInPeriod,
    leadsClosedInPeriod: leadsClosedSuccessInPeriod + leadsClosedLostInPeriod,
    openLeadsTotal,
    followUpOpenCount,
    topServiceConcentration,
    dominantFollowUpReason,
    inactiveOpenLeads,
    topLostReason,
    overdueFollowups: overdue.count
  };
}

export async function getBusinessInsights(now = new Date()) {
  const period = resolveInsightsPeriod(now);
  const data = await gatherBusinessInsightData(period, now);
  const insights = buildBusinessInsightsFromData(data);

  return {
    action: "GET_BUSINESS_INSIGHTS",
    period: {
      days: period.days,
      start: period.periodStartLabel,
      end: period.periodEndLabel
    },
    insights,
    summaryText: formatBusinessInsightsText(insights),
    evidence: {
      leadsCreatedInPeriod: data.leadsCreatedInPeriod,
      leadsClosedSuccessInPeriod: data.leadsClosedSuccessInPeriod,
      leadsClosedLostInPeriod: data.leadsClosedLostInPeriod,
      openLeadsTotal: data.openLeadsTotal,
      overdueFollowups: data.overdueFollowups,
      inactiveOpenLeads: data.inactiveOpenLeads
    }
  };
}
