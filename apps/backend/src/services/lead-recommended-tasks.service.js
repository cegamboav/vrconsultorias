import { prisma, LeadStatus } from "@crm/database";
import { addDaysLocal, calendarDaysFromTodayStart, startOfLocalDay } from "../utils/follow-up-date.js";
import {
  gatherBusinessInsightData,
  resolveInsightsPeriod
} from "./lead-business-insights.service.js";
import { getPriorityLeads } from "./lead-priority.service.js";
import {
  getActionableLeads,
  getOverdueFollowups,
  getUpcomingFollowups
} from "./lead-agenda.service.js";

const OPEN_STATUSES = [
  LeadStatus.NEW,
  LeadStatus.CONTACTED,
  LeadStatus.SCHEDULED,
  LeadStatus.FOLLOW_UP
];

const LEVEL_ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

async function getInactiveOpenLeads(now, limit = 5) {
  const inactivityThreshold = addDaysLocal(startOfLocalDay(now), -14);

  return prisma.lead.findMany({
    where: {
      status: { in: OPEN_STATUSES },
      OR: [{ lastActivityAt: null }, { lastActivityAt: { lt: inactivityThreshold } }]
    },
    orderBy: [{ lastActivityAt: "asc" }, { leadNumber: "asc" }],
    take: limit,
    select: {
      id: true,
      leadNumber: true,
      fullName: true,
      status: true,
      lastActivityAt: true
    }
  });
}

function contactTask({ lead, level, horizon, overdue = false }) {
  return {
    level,
    horizon,
    type: "CONTACT_LEAD",
    leadId: lead.leadId ?? lead.id,
    leadNumber: lead.leadNumber,
    leadName: lead.fullName,
    message: overdue
      ? `Contactar a ${lead.fullName} (seguimiento vencido).`
      : `Contactar a ${lead.fullName}.`
  };
}

/**
 * @param {object} ctx
 */
export function buildRecommendedTasksFromContext(ctx) {
  const tasks = [];
  const seenLeadIds = new Set();

  for (const lead of ctx.overdueLeads) {
    const leadId = lead.leadId ?? lead.id;
    if (!leadId || seenLeadIds.has(leadId)) continue;
    seenLeadIds.add(leadId);
    tasks.push(contactTask({ lead, level: "CRITICAL", horizon: "TODAY", overdue: true }));
  }

  for (const lead of ctx.actionableLeads) {
    const leadId = lead.leadId ?? lead.id;
    if (!leadId || seenLeadIds.has(leadId)) continue;
    seenLeadIds.add(leadId);
    tasks.push(contactTask({ lead, level: "HIGH", horizon: "TODAY" }));
  }

  for (const lead of ctx.priorityLeads) {
    if (!lead.leadId || seenLeadIds.has(lead.leadId)) continue;
    seenLeadIds.add(lead.leadId);
    tasks.push(contactTask({ lead, level: "HIGH", horizon: "TODAY" }));
  }

  for (const lead of ctx.inactiveLeads) {
    if (seenLeadIds.has(lead.id)) continue;
    tasks.push({
      level: "MEDIUM",
      horizon: "THIS_WEEK",
      type: "REACTIVATE_LEAD",
      leadId: lead.id,
      leadNumber: lead.leadNumber,
      leadName: lead.fullName,
      message: `Retomar contacto con ${lead.fullName}.`
    });
  }

  for (const lead of ctx.upcomingLeads) {
    const leadId = lead.leadId ?? lead.id;
    if (!leadId || seenLeadIds.has(leadId)) continue;

    const dayOffset = lead.nextActionDate
      ? calendarDaysFromTodayStart(startOfLocalDay(new Date(lead.nextActionDate)))
      : 1;
    if (dayOffset <= 0) continue;

    tasks.push({
      level: "MEDIUM",
      horizon: "THIS_WEEK",
      type: "FOLLOW_UP",
      leadId,
      leadNumber: lead.leadNumber,
      leadName: lead.fullName,
      message: `Dar seguimiento a ${lead.fullName}${lead.groupDateLabel ? ` (${lead.groupDateLabel})` : ""}.`
    });
  }

  if (
    ctx.dominantFollowUpReason?.reason === "NO_MONEY" &&
    ctx.dominantFollowUpReason.share >= 0.5
  ) {
    tasks.push({
      level: "MEDIUM",
      horizon: "THIS_WEEK",
      type: "FOLLOW_UP_SEGMENT",
      message: "Dar seguimiento a clientes con limitaciones económicas."
    });
  }

  if (ctx.dominantFollowUpReason?.reason === "THINKING" && ctx.dominantFollowUpReason.share >= 0.5) {
    tasks.push({
      level: "MEDIUM",
      horizon: "THIS_WEEK",
      type: "FOLLOW_UP_SEGMENT",
      message: "Contactar leads indecisos para resolver dudas pendientes."
    });
  }

  if (ctx.openLeadsTotal > 0 && ctx.openLeadsTotal <= 5) {
    tasks.push({
      level: "MEDIUM",
      horizon: "THIS_WEEK",
      type: "LEAD_GENERATION",
      message: "Generar al menos 3 nuevos leads."
    });
  }

  tasks.push({
    level: "LOW",
    horizon: "LOW_PRIORITY",
    type: "REVIEW_NOTES",
    message: "Revisar notas y actualizar información de leads activos."
  });

  return sortRecommendedTasks(tasks);
}

export function sortRecommendedTasks(tasks) {
  return [...tasks]
    .sort((a, b) => {
      const levelDiff = (LEVEL_ORDER[a.level] ?? 9) - (LEVEL_ORDER[b.level] ?? 9);
      if (levelDiff !== 0) return levelDiff;
      const horizonOrder = { TODAY: 0, THIS_WEEK: 1, LOW_PRIORITY: 2 };
      return (horizonOrder[a.horizon] ?? 9) - (horizonOrder[b.horizon] ?? 9);
    })
    .map((task, index) => ({
      ...task,
      priority: index + 1
    }));
}

const TODAY_SCOPE_PATTERNS = [
  /\bhoy exactamente\b/,
  /\bqu[ée]\s+hago\s+hoy\b/,
  /\bqu[ée]\s+debo\s+hacer\s+hoy\b/,
  /\bqu[ée]\s+deber[ií]a\s+hacer\s+hoy\b/,
  /\ben\s+qu[ée]\s+deber[ií]a\s+enfocarme\s+hoy\b/,
  /\besta mañana\b/,
  /\besta tarde\b/,
  /\bhoy\b/
];

const WEEK_SCOPE_PATTERNS = [
  /\besta semana\b/,
  /\bplan de trabajo\b/,
  /\borganiza mis prioridades\b/,
  /\btareas de esta semana\b/,
  /\bqu[ée]\s+tareas tengo\b/
];

/**
 * @param {string} [message]
 * @param {{ scope?: string }} [interpretation]
 * @returns {"TODAY" | "WEEK"}
 */
export function resolveRecommendedTasksScope(message, interpretation = {}) {
  const fromInterpretation = String(interpretation.scope ?? "")
    .trim()
    .toUpperCase();
  if (fromInterpretation === "TODAY" || fromInterpretation === "WEEK") {
    return fromInterpretation;
  }

  const text = String(message ?? "").toLowerCase();

  if (TODAY_SCOPE_PATTERNS.some((pattern) => pattern.test(text))) {
    return "TODAY";
  }

  if (WEEK_SCOPE_PATTERNS.some((pattern) => pattern.test(text))) {
    return "WEEK";
  }

  return "WEEK";
}

/**
 * @param {Array<{ horizon: string }>} tasks
 * @param {"TODAY" | "WEEK"} scope
 */
export function applyRecommendedTasksScope(tasks, scope) {
  if (scope !== "TODAY") {
    return tasks;
  }

  const withoutPriority = tasks
    .filter((task) => task.horizon === "TODAY")
    .map(({ priority, ...task }) => task);

  return sortRecommendedTasks(withoutPriority);
}

/**
 * @param {Array<{ horizon: string, message: string, priority: number }>} tasks
 * @param {"TODAY" | "WEEK"} [scope]
 */
export function formatRecommendedTasksText(tasks, scope = "WEEK") {
  if (scope === "TODAY") {
    if (tasks.length === 0) {
      return "Plan para hoy\n\nNo hay tareas recomendadas para hoy.";
    }

    const lines = ["Plan para hoy", ""];
    for (const task of tasks) {
      lines.push(`${task.priority}. ${task.message}`);
    }
    return lines.join("\n").trim();
  }

  if (tasks.length === 0) {
    return "Plan de trabajo\n\nNo hay tareas recomendadas.";
  }

  const today = tasks.filter((t) => t.horizon === "TODAY");
  const week = tasks.filter((t) => t.horizon === "THIS_WEEK");
  const low = tasks.filter((t) => t.horizon === "LOW_PRIORITY");

  const lines = ["Plan de trabajo", ""];

  if (today.length > 0) {
    lines.push("Hoy", "");
    for (const task of today) {
      lines.push(`${task.priority}. ${task.message}`);
    }
    lines.push("");
  }

  if (week.length > 0) {
    lines.push("Esta semana", "");
    for (const task of week) {
      lines.push(`${task.priority}. ${task.message}`);
    }
    lines.push("");
  }

  if (low.length > 0) {
    lines.push("Baja prioridad", "");
    for (const task of low) {
      lines.push(`${task.priority}. ${task.message}`);
    }
  }

  return lines.join("\n").trim();
}

/**
 * @param {{ now?: Date, message?: string, interpretation?: object }} [options]
 */
export async function getRecommendedTasks(options = {}) {
  const now = options.now ?? new Date();
  const scope = resolveRecommendedTasksScope(options.message, options.interpretation);
  const period = resolveInsightsPeriod(now);
  const todayStart = startOfLocalDay(now);
  const weekEndExclusive = addDaysLocal(todayStart, 8);

  const [insightData, priority, actionable, overdue, upcoming, inactiveLeads] =
    await Promise.all([
      gatherBusinessInsightData(period, now),
      getPriorityLeads(),
      getActionableLeads(),
      getOverdueFollowups(),
      getUpcomingFollowups({
        rangeStart: addDaysLocal(todayStart, 1),
        rangeEndExclusive: weekEndExclusive
      }),
      getInactiveOpenLeads(now)
    ]);

  const context = {
    overdueLeads: overdue.leads,
    actionableLeads: actionable.leads,
    priorityLeads: priority.leads.slice(0, 3),
    upcomingLeads: upcoming.leads,
    inactiveLeads,
    dominantFollowUpReason: insightData.dominantFollowUpReason,
    openLeadsTotal: insightData.openLeadsTotal
  };

  const allTasks = buildRecommendedTasksFromContext(context);
  const tasks = applyRecommendedTasksScope(allTasks, scope);

  return {
    action: "GET_RECOMMENDED_TASKS",
    scope,
    tasks,
    summaryText: formatRecommendedTasksText(tasks, scope),
    evidence: {
      overdueCount: overdue.count,
      actionableCount: actionable.count,
      priorityLeadCount: context.priorityLeads.length,
      upcomingCount: upcoming.count,
      inactiveCount: inactiveLeads.length,
      openLeadsTotal: insightData.openLeadsTotal
    }
  };
}
