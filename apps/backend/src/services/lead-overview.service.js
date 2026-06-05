import { LeadStatus } from "@crm/database";
import { countLeadsByStatus } from "./lead-queries.service.js";
import {
  getNextLeadsToAttend,
  getOverdueFollowups,
  getTodayAgenda,
  getTomorrowAgenda
} from "./lead-agenda.service.js";

const OVERVIEW_STATUS_ORDER = [
  LeadStatus.NEW,
  LeadStatus.CONTACTED,
  LeadStatus.SCHEDULED,
  LeadStatus.FOLLOW_UP,
  LeadStatus.CLOSED_SUCCESS,
  LeadStatus.CLOSED_LOST
];

const STATUS_OVERVIEW_LABEL_PLURAL = {
  NEW: "Nuevos",
  CONTACTED: "Contactados",
  SCHEDULED: "Agendados",
  FOLLOW_UP: "Seguimiento",
  CLOSED_SUCCESS: "Concretados",
  CLOSED_LOST: "No concretados"
};

export function buildOverviewSummaryText({
  total,
  byStatus,
  todayCount,
  tomorrowCount,
  overdueCount,
  nextLeads
}) {
  const lines = ["Resumen CRM", "", `Leads totales: ${total}`, "", "Por estado:"];

  for (const status of OVERVIEW_STATUS_ORDER) {
    const count = byStatus[status] ?? 0;
    const label = STATUS_OVERVIEW_LABEL_PLURAL[status] ?? status;
    lines.push(`• ${label}: ${count}`);
  }

  lines.push("");
  lines.push(`Acciones pendientes hoy: ${todayCount}`);
  lines.push(`Acciones programadas mañana: ${tomorrowCount}`);
  lines.push(`Seguimientos atrasados: ${overdueCount}`);
  lines.push("");
  lines.push("Top 3 próximos leads a atender:");

  if (!nextLeads.length) {
    lines.push("• Sin acciones programadas próximas.");
  } else {
    for (const lead of nextLeads) {
      lines.push(`• ${lead.fullName}`);
    }
  }

  return lines.join("\n");
}

export async function getCrmOverview() {
  const [counts, today, tomorrow, overdue, nextLeads] = await Promise.all([
    countLeadsByStatus(),
    getTodayAgenda(),
    getTomorrowAgenda(),
    getOverdueFollowups(),
    getNextLeadsToAttend({ limit: 3 })
  ]);

  const summaryText = buildOverviewSummaryText({
    total: counts.total,
    byStatus: counts.byStatus,
    todayCount: today.count,
    tomorrowCount: tomorrow.count,
    overdueCount: overdue.count,
    nextLeads
  });

  return {
    total: counts.total,
    byStatus: counts.byStatus,
    statusSummary: counts.summary.map((row) => ({
      ...row,
      overviewLabel: STATUS_OVERVIEW_LABEL_PLURAL[row.status] ?? row.statusLabel
    })),
    todayPendingCount: today.count,
    tomorrowScheduledCount: tomorrow.count,
    overdueFollowupsCount: overdue.count,
    nextLeadsToAttend: nextLeads,
    summaryText
  };
}
