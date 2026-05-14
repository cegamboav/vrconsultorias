import { prisma, LeadSource, LeadStatus, FollowUpReason } from "@crm/database";

const ALL_STATUSES = [
  LeadStatus.NEW,
  LeadStatus.CONTACTED,
  LeadStatus.SCHEDULED,
  LeadStatus.FOLLOW_UP,
  LeadStatus.CLOSED_INVESTED,
  LeadStatus.CLOSED_NOT_INVESTED
];

const ALL_SOURCES = [
  LeadSource.REFERIDO,
  LeadSource.DIRECTO,
  LeadSource.PAGINA_WEB,
  LeadSource.REDES_SOCIALES,
  LeadSource.OTRO
];

const ALL_FOLLOW_UP_REASONS = [
  FollowUpReason.NO_RESPONSE,
  FollowUpReason.NO_MONEY,
  FollowUpReason.CALL_LATER,
  FollowUpReason.THINKING,
  FollowUpReason.BUSY,
  FollowUpReason.OTHER
];

function bucketsFromGroup(groupRows, fieldName, keys) {
  const out = Object.fromEntries(keys.map((k) => [k, 0]));
  for (const row of groupRows) {
    const key = row[fieldName];
    if (!key) continue;
    const count = row._count?._all ?? 0;
    if (Object.prototype.hasOwnProperty.call(out, key)) {
      out[key] = count;
    }
  }
  return out;
}

function safeRate(numerator, denominator) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 1000) / 10; // 1 decimal
}

function buildDateFilter(field, from, to) {
  if (!from && !to) return undefined;
  const filter = {};
  if (from) filter.gte = from;
  if (to) filter.lte = to;
  return { [field]: filter };
}

/**
 * @param {{ from: Date|null, to: Date|null }} range
 */
export async function getReportsSnapshot({ from = null, to = null } = {}) {
  const createdAtFilter = buildDateFilter("createdAt", from, to);
  const closedAtFilter = buildDateFilter("closedAt", from, to);

  const [
    byStatusInRange,
    byStatusLive,
    bySource,
    followUpReasonsRaw,
    topReferrersRaw,
    totalLeadsInRange,
    totalInvestedInRange,
    totalNotInvestedInRange
  ] = await Promise.all([
    // Pipeline filtrado por createdAt: cuántos leads CREADOS en el período
    // están actualmente en cada estado (útil para entender cómo evoluciona la cohorte).
    prisma.lead.groupBy({
      by: ["status"],
      where: createdAtFilter ?? undefined,
      _count: { _all: true }
    }),
    // Pipeline “vivo”: foto del estado actual del CRM (siempre, sin filtro).
    prisma.lead.groupBy({
      by: ["status"],
      _count: { _all: true }
    }),
    // Leads por fuente: filtrado por createdAt.
    prisma.lead.groupBy({
      by: ["source"],
      where: createdAtFilter ?? undefined,
      _count: { _all: true }
    }),
    // Motivos de FOLLOW_UP "ocurridos en el período": contamos actividades
    // STATUS_CHANGED hacia FOLLOW_UP, agrupadas por motivo guardado en metadata.
    // Uso NULL-safe comparison para que el mismo query sirva con y sin filtro.
    prisma.$queryRaw`
      SELECT
        (a."metadata"->>'followUpReason') AS "followUpReason",
        COUNT(*)::int                     AS "count"
      FROM "Activity" a
      WHERE a."type" = 'STATUS_CHANGED'
        AND (a."metadata"->>'to') = 'FOLLOW_UP'
        AND (a."metadata"->>'followUpReason') IS NOT NULL
        AND (${from}::timestamptz IS NULL OR a."createdAt" >= ${from}::timestamptz)
        AND (${to}::timestamptz   IS NULL OR a."createdAt" <= ${to}::timestamptz)
      GROUP BY (a."metadata"->>'followUpReason')
    `,
    // Top referidores por leads referidos CREADOS en el período.
    prisma.$queryRaw`
      SELECT
        ref."id"          AS "referrerId",
        ref."leadNumber"  AS "leadNumber",
        ref."fullName"    AS "fullName",
        ref."phone"       AS "phone",
        COUNT(*)::int                                                       AS "referredCount",
        COUNT(*) FILTER (WHERE child."status" = 'CLOSED_INVESTED')::int     AS "investedCount",
        COUNT(*) FILTER (WHERE child."status" = 'CLOSED_NOT_INVESTED')::int AS "notInvestedCount"
      FROM "Lead" child
      INNER JOIN "Lead" ref ON ref."id" = child."referredByLeadId"
      WHERE child."referredByLeadId" IS NOT NULL
        AND (${from}::timestamptz IS NULL OR child."createdAt" >= ${from}::timestamptz)
        AND (${to}::timestamptz   IS NULL OR child."createdAt" <= ${to}::timestamptz)
      GROUP BY ref."id", ref."leadNumber", ref."fullName", ref."phone"
      ORDER BY "referredCount" DESC, "investedCount" DESC
      LIMIT 10
    `,
    // Conversión:
    // totalLeads = leads CREADOS en el período.
    prisma.lead.count({ where: createdAtFilter ?? undefined }),
    // totalInvested = leads cerrados invertidos CERRADOS en el período.
    prisma.lead.count({
      where: {
        status: LeadStatus.CLOSED_INVESTED,
        ...(closedAtFilter ?? {})
      }
    }),
    // totalNotInvested = leads cerrados no invertidos CERRADOS en el período.
    prisma.lead.count({
      where: {
        status: LeadStatus.CLOSED_NOT_INVESTED,
        ...(closedAtFilter ?? {})
      }
    })
  ]);

  const pipelineCurrent = bucketsFromGroup(byStatusLive, "status", ALL_STATUSES);
  const pipelineInRange = bucketsFromGroup(byStatusInRange, "status", ALL_STATUSES);
  const leadsBySource = bucketsFromGroup(bySource, "source", ALL_SOURCES);

  const followUpReasons = Object.fromEntries(ALL_FOLLOW_UP_REASONS.map((k) => [k, 0]));
  for (const row of followUpReasonsRaw ?? []) {
    const key = row.followUpReason;
    if (key && Object.prototype.hasOwnProperty.call(followUpReasons, key)) {
      followUpReasons[key] = Number(row.count) || 0;
    }
  }

  const totalClosed = totalInvestedInRange + totalNotInvestedInRange;

  const conversion = {
    totalLeads: totalLeadsInRange,
    totalInvested: totalInvestedInRange,
    totalNotInvested: totalNotInvestedInRange,
    // Tasa global: invertidos cerrados en el período / leads creados en el período.
    conversionRate: safeRate(totalInvestedInRange, totalLeadsInRange),
    // Conversión sobre cerrados (contexto secundario).
    conversionOverClosedRate: safeRate(totalInvestedInRange, totalClosed)
  };

  const topReferrers = (topReferrersRaw ?? []).map((row) => ({
    referrerId: row.referrerId,
    leadNumber: row.leadNumber,
    fullName: row.fullName,
    phone: row.phone,
    referredCount: Number(row.referredCount) || 0,
    investedCount: Number(row.investedCount) || 0,
    notInvestedCount: Number(row.notInvestedCount) || 0
  }));

  return {
    range: {
      from: from ? from.toISOString() : null,
      to: to ? to.toISOString() : null,
      hasFilter: Boolean(from || to)
    },
    conversion,
    pipelineCurrent,
    pipelineInRange,
    leadsBySource,
    followUpReasons,
    topReferrers
  };
}
