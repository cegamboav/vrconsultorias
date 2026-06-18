import {
  gatherBusinessInsightData,
  resolveInsightsPeriod
} from "./lead-business-insights.service.js";
import { getPriorityLeads } from "./lead-priority.service.js";
import { getActionableLeads, getOverdueFollowups } from "./lead-agenda.service.js";

const LEVEL_ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

/**
 * @param {object} ctx
 */
export function buildBusinessRecommendationsFromContext(ctx) {
  const recommendations = [];

  if (ctx.overdueCount > 0) {
    recommendations.push({
      level: "CRITICAL",
      type: "OVERDUE_FOLLOW_UPS",
      message: "Contactar inmediatamente los leads con seguimiento vencido.",
      leadNames: ctx.overdueLeadNames
    });
  }

  if (ctx.topPriorityLeads.length > 0) {
    recommendations.push({
      level: ctx.overdueCount > 0 ? "HIGH" : "HIGH",
      type: "PRIORITY_LEADS",
      message: "Contactar los leads prioritarios:",
      leadNames: ctx.topPriorityLeads.map((l) => l.fullName)
    });
  }

  if (
    ctx.dominantFollowUpReason?.reason === "NO_MONEY" &&
    ctx.dominantFollowUpReason.share >= 0.5
  ) {
    recommendations.push({
      level: "HIGH",
      type: "FOLLOW_UP_NO_MONEY",
      message:
        "Dar seguimiento a clientes con limitaciones económicas para validar cambios en su situación."
    });
  }

  if (
    ctx.dominantFollowUpReason?.reason === "THINKING" &&
    ctx.dominantFollowUpReason.share >= 0.5
  ) {
    recommendations.push({
      level: "HIGH",
      type: "FOLLOW_UP_THINKING",
      message: "Contactar leads indecisos para resolver dudas pendientes."
    });
  }

  if (ctx.actionableCount > 0 && ctx.overdueCount === 0) {
    recommendations.push({
      level: "HIGH",
      type: "ACTIONABLE_TODAY",
      message: "Atender los seguimientos programados para hoy.",
      leadNames: ctx.actionableLeadNames
    });
  }

  if (ctx.inactiveOpenLeads > 0) {
    recommendations.push({
      level: "MEDIUM",
      type: "INACTIVITY",
      message: "Reactivar leads abiertos sin actividad reciente."
    });
  }

  if (ctx.openLeadsTotal > 0 && ctx.openLeadsTotal <= 5) {
    recommendations.push({
      level: "MEDIUM",
      type: "LEAD_GENERATION",
      message:
        "Incrementar la generación de nuevos leads, ya que la cartera activa es reducida."
    });
  }

  if (
    ctx.leadsClosedSuccessInPeriod > ctx.leadsClosedLostInPeriod &&
    ctx.leadsClosedSuccessInPeriod > 0
  ) {
    recommendations.push({
      level: "LOW",
      type: "CLOSING_MOMENTUM",
      message:
        "Mantener la estrategia comercial actual debido a la buena tasa de cierre reciente."
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      level: "MEDIUM",
      type: "GENERAL",
      message:
        "Revisar el pipeline abierto y programar seguimientos con fechas concretas para cada lead."
    });
  }

  return sortBusinessRecommendations(recommendations);
}

/**
 * @param {Array<{ level: string }>} recommendations
 */
export function sortBusinessRecommendations(recommendations) {
  return [...recommendations]
    .sort((a, b) => (LEVEL_ORDER[a.level] ?? 9) - (LEVEL_ORDER[b.level] ?? 9))
    .map((item, index) => ({
      ...item,
      priority: index + 1
    }));
}

/**
 * @param {Array<{ message: string, leadNames?: string[] }>} recommendations
 */
export function formatBusinessRecommendationsText(recommendations) {
  if (recommendations.length === 0) {
    return "Recomendaciones comerciales\n\nNo hay recomendaciones disponibles.";
  }

  const lines = ["Recomendaciones comerciales", ""];

  recommendations.forEach((item, index) => {
    lines.push(`${index + 1}. ${item.message}`);
    if (item.leadNames?.length) {
      for (const name of item.leadNames) {
        lines.push(`   - ${name}`);
      }
    }
    lines.push("");
  });

  return lines.join("\n").trimEnd();
}

export async function getBusinessRecommendations(now = new Date()) {
  const period = resolveInsightsPeriod(now);

  const [insightData, priority, actionable, overdue] = await Promise.all([
    gatherBusinessInsightData(period, now),
    getPriorityLeads(),
    getActionableLeads(),
    getOverdueFollowups()
  ]);

  const context = {
    overdueCount: overdue.count,
    overdueLeadNames: overdue.leads.map((l) => l.fullName),
    actionableCount: actionable.count,
    actionableLeadNames: actionable.leads.map((l) => l.fullName),
    topPriorityLeads: priority.leads.slice(0, 3),
    dominantFollowUpReason: insightData.dominantFollowUpReason,
    openLeadsTotal: insightData.openLeadsTotal,
    inactiveOpenLeads: insightData.inactiveOpenLeads,
    leadsClosedSuccessInPeriod: insightData.leadsClosedSuccessInPeriod,
    leadsClosedLostInPeriod: insightData.leadsClosedLostInPeriod
  };

  const recommendations = buildBusinessRecommendationsFromContext(context);

  return {
    action: "GET_BUSINESS_RECOMMENDATIONS",
    recommendations,
    evidence: context,
    summaryText: formatBusinessRecommendationsText(recommendations)
  };
}
