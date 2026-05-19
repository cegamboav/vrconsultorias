import { prisma, LeadSource, LeadStatus, FollowUpReason, ActivityType } from "@crm/database";

const ALL_STATUSES = [
  LeadStatus.NEW,
  LeadStatus.CONTACTED,
  LeadStatus.SCHEDULED,
  LeadStatus.FOLLOW_UP,
  LeadStatus.CLOSED_SUCCESS,
  LeadStatus.CLOSED_LOST
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

/** @returns {Record<string, { gte?: Date, lte?: Date }> | undefined} Fragmento de `where` para spread. */
function buildDateFilter(field, from, to) {
  if (!from && !to) return undefined;
  const range = {};
  if (from) range.gte = from;
  if (to) range.lte = to;
  return { [field]: range };
}

function mergeCreatedAtFilter(baseWhere, createdAtFilter) {
  if (!createdAtFilter) return baseWhere;
  return { ...baseWhere, ...createdAtFilter };
}

/** Agrega motivos de FOLLOW_UP desde actividades (sin SQL raw). */
async function aggregateFollowUpReasons({ from, to }) {
  const createdAtFilter = buildDateFilter("createdAt", from, to);

  const activities = await prisma.activity.findMany({
    where: {
      type: ActivityType.STATUS_CHANGED,
      ...(createdAtFilter ?? {}),
      AND: [
        { metadata: { path: ["to"], equals: "FOLLOW_UP" } },
        { metadata: { path: ["followUpReason"], not: null } }
      ]
    },
    select: { metadata: true }
  });

  const counts = Object.fromEntries(ALL_FOLLOW_UP_REASONS.map((k) => [k, 0]));
  for (const row of activities) {
    const meta = row.metadata;
    if (!meta || typeof meta !== "object" || Array.isArray(meta)) continue;
    const reason = meta.followUpReason;
    if (reason && Object.prototype.hasOwnProperty.call(counts, reason)) {
      counts[reason] += 1;
    }
  }
  return counts;
}

/** Top referidores por leads referidos en el período (sin SQL raw). */
async function aggregateTopReferrers({ from, to }) {
  const createdAtFilter = buildDateFilter("createdAt", from, to);

  const referred = await prisma.lead.findMany({
    where: {
      referredByLeadId: { not: null },
      ...(createdAtFilter ?? {})
    },
    select: {
      status: true,
      referredByLead: {
        select: { id: true, leadNumber: true, fullName: true, phone: true }
      }
    }
  });

  const byReferrer = new Map();

  for (const row of referred) {
    const ref = row.referredByLead;
    if (!ref) continue;

    let agg = byReferrer.get(ref.id);
    if (!agg) {
      agg = {
        referrerId: ref.id,
        leadNumber: ref.leadNumber,
        fullName: ref.fullName,
        phone: ref.phone,
        referredCount: 0,
        successCount: 0,
        lostCount: 0
      };
      byReferrer.set(ref.id, agg);
    }

    agg.referredCount += 1;
    if (row.status === LeadStatus.CLOSED_SUCCESS) agg.successCount += 1;
    if (row.status === LeadStatus.CLOSED_LOST) agg.lostCount += 1;
  }

  return [...byReferrer.values()]
    .sort((a, b) => b.referredCount - a.referredCount || b.successCount - a.successCount)
    .slice(0, 10);
}

/**
 * @param {{ from: Date|null, to: Date|null }} range
 */
export async function getReportsSnapshot({ from = null, to = null } = {}) {
  const createdAtFilter = buildDateFilter("createdAt", from, to);
  const closedAtFilter = buildDateFilter("closedAt", from, to);

  const activeCategories = await prisma.serviceCategory.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true, color: true }
  });

  const [
    byStatusInRange,
    byStatusLive,
    bySource,
    byServiceRaw,
    followUpReasons,
    topReferrers,
    totalLeadsInRange,
    totalSuccessInRange,
    totalLostInRange
  ] = await Promise.all([
    prisma.lead.groupBy({
      by: ["status"],
      where: createdAtFilter ?? undefined,
      _count: { _all: true }
    }),
    prisma.lead.groupBy({
      by: ["status"],
      _count: { _all: true }
    }),
    prisma.lead.groupBy({
      by: ["source"],
      where: createdAtFilter ?? undefined,
      _count: { _all: true }
    }),
    prisma.lead.groupBy({
      by: ["serviceCategoryId"],
      where: createdAtFilter ?? undefined,
      _count: { _all: true }
    }),
    aggregateFollowUpReasons({ from, to }),
    aggregateTopReferrers({ from, to }),
    prisma.lead.count({ where: createdAtFilter ?? undefined }),
    prisma.lead.count({
      where: mergeCreatedAtFilter(
        { status: LeadStatus.CLOSED_SUCCESS },
        closedAtFilter
      )
    }),
    prisma.lead.count({
      where: mergeCreatedAtFilter({ status: LeadStatus.CLOSED_LOST }, closedAtFilter)
    })
  ]);

  const pipelineCurrent = bucketsFromGroup(byStatusLive, "status", ALL_STATUSES);
  const pipelineInRange = bucketsFromGroup(byStatusInRange, "status", ALL_STATUSES);
  const leadsBySource = bucketsFromGroup(bySource, "source", ALL_SOURCES);

  const leadsByService = activeCategories.map((cat) => {
    const row = byServiceRaw.find((r) => r.serviceCategoryId === cat.id);
    return {
      ...cat,
      count: row?._count?._all ?? 0
    };
  });

  const totalClosed = totalSuccessInRange + totalLostInRange;

  const conversion = {
    totalLeads: totalLeadsInRange,
    totalConcreted: totalSuccessInRange,
    totalNotConcreted: totalLostInRange,
    conversionRate: safeRate(totalSuccessInRange, totalLeadsInRange),
    conversionOverClosedRate: safeRate(totalSuccessInRange, totalClosed)
  };

  const conversionByService = await Promise.all(
    activeCategories.map(async (cat) => {
      const totalLeads = await prisma.lead.count({
        where: mergeCreatedAtFilter({ serviceCategoryId: cat.id }, createdAtFilter)
      });
      const totalConcreted = await prisma.lead.count({
        where: mergeCreatedAtFilter(
          { serviceCategoryId: cat.id, status: LeadStatus.CLOSED_SUCCESS },
          closedAtFilter
        )
      });
      const totalNotConcreted = await prisma.lead.count({
        where: mergeCreatedAtFilter(
          { serviceCategoryId: cat.id, status: LeadStatus.CLOSED_LOST },
          closedAtFilter
        )
      });
      return {
        ...cat,
        totalLeads,
        totalConcreted,
        totalNotConcreted,
        conversionRate: safeRate(totalConcreted, totalLeads)
      };
    })
  );

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
    leadsByService,
    conversionByService,
    followUpReasons,
    topReferrers
  };
}
