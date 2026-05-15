import {
  prisma,
  ActivityType,
  FollowUpReason,
  LeadSource,
  LeadStatus
} from "@crm/database";
import { AppError } from "../utils/app-error.js";
import {
  followUpReasonLabelEs,
  formatStatusChangeDescription
} from "../constants/lead-copy.es.js";
import {
  assertMinSevenDaysFollowUp,
  followUpDateAfterCalendarDays,
  formatSpanishDayMonthYear,
  parseDateInputToStartOfDay,
  startOfLocalDay,
  toYmdLocal
} from "../utils/follow-up-date.js";

const allowedTransitions = {
  NEW: ["CONTACTED"],
  CONTACTED: ["SCHEDULED", "FOLLOW_UP"],
  SCHEDULED: ["CLOSED_SUCCESS", "CLOSED_LOST", "FOLLOW_UP"],
  // El asesor puede cerrar manualmente un lead que está en seguimiento
  // (típicamente después de varios intentos sin respuesta).
  FOLLOW_UP: ["CONTACTED", "SCHEDULED", "CLOSED_SUCCESS", "CLOSED_LOST"],
  CLOSED_SUCCESS: [],
  CLOSED_LOST: ["FOLLOW_UP", "CONTACTED", "SCHEDULED"]
};

const legacySourceMap = {
  REFERRAL: "REFERIDO",
  DIRECT: "DIRECTO",
  ORGANIC: "PAGINA_WEB",
  OTHER: "OTRO"
};

function ensureLeadExists(lead) {
  if (!lead) throw new AppError("Lead no encontrado.", 404);
}

function normalizeSource(source) {
  if (!source) return LeadSource.OTRO;
  if (Object.prototype.hasOwnProperty.call(LeadSource, source)) {
    return LeadSource[source];
  }
  const legacy = legacySourceMap[source];
  if (legacy && Object.prototype.hasOwnProperty.call(LeadSource, legacy)) {
    return LeadSource[legacy];
  }
  return LeadSource.OTRO;
}

function validateStatusTransition(currentStatus, nextStatus) {
  const allowed = allowedTransitions[currentStatus] ?? [];
  if (!allowed.includes(nextStatus)) {
    throw new AppError("Transición no permitida entre estados.", 400);
  }
}

function isClosedStatus(status) {
  return status === LeadStatus.CLOSED_SUCCESS || status === LeadStatus.CLOSED_LOST;
}

const SERVICE_CATEGORY_SELECT = {
  id: true,
  name: true,
  slug: true,
  color: true
};

async function assertServiceCategoryValid(serviceCategoryId) {
  if (!serviceCategoryId) {
    throw new AppError("Selecciona el servicio del lead.", 400);
  }
  const cat = await prisma.serviceCategory.findFirst({
    where: { id: String(serviceCategoryId).trim(), isActive: true },
    select: { id: true }
  });
  if (!cat) {
    throw new AppError("Servicio no válido.", 400);
  }
  return cat.id;
}

function normalizeFollowUpReason(value) {
  if (value === undefined || value === null || value === "") return null;
  const key = String(value).trim().toUpperCase();
  if (!Object.prototype.hasOwnProperty.call(FollowUpReason, key)) {
    throw new AppError("Motivo de seguimiento no válido.", 400);
  }
  return FollowUpReason[key];
}

async function assertReferrerLeadValid(referrerId, currentLeadId) {
  if (!referrerId) return;
  if (referrerId === currentLeadId) {
    throw new AppError("Un lead no puede referirse a sí mismo.", 400);
  }
  const other = await prisma.lead.findUnique({
    where: { id: referrerId },
    select: { id: true }
  });
  if (!other) {
    throw new AppError("El lead referidor no existe.", 400);
  }
}

// Orden operativo: del más activo / accionable arriba, al cerrado abajo.
const statusPriority = {
  NEW: 1,
  CONTACTED: 2,
  SCHEDULED: 3,
  FOLLOW_UP: 4,
  CLOSED_SUCCESS: 5,
  CLOSED_LOST: 6
};

function compareLeadsForBandeja(a, b) {
  const pa = statusPriority[a.status] ?? 99;
  const pb = statusPriority[b.status] ?? 99;
  if (pa !== pb) return pa - pb;

  const aTs = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
  const bTs = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
  return bTs - aTs; // DESC dentro del grupo
}

export async function listLeads() {
  const leads = await prisma.lead.findMany({
    select: {
      id: true,
      leadNumber: true,
      fullName: true,
      phone: true,
      email: true,
      source: true,
      status: true,
      followUpReason: true,
      followUpCount: true,
      nextActionDate: true,
      lastActivityAt: true,
      createdAt: true,
      updatedAt: true,
      serviceCategory: { select: SERVICE_CATEGORY_SELECT }
    }
  });

  return leads.sort(compareLeadsForBandeja);
}

export async function searchLeadsForReferrer({ query, excludeLeadId }) {
  const q = String(query ?? "").trim();
  if (q.length < 2) {
    return [];
  }

  return prisma.lead.findMany({
    where: {
      ...(excludeLeadId ? { id: { not: excludeLeadId } } : {}),
      OR: [
        { fullName: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } }
      ]
    },
    take: 15,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      leadNumber: true,
      fullName: true,
      phone: true
    }
  });
}

export async function createLead({ userId, payload }) {
  const {
    fullName,
    phone,
    email,
    source,
    serviceCategoryId,
    referredBy,
    referredByLeadId,
    observations,
    nextActionDate
  } = payload;

  if (!fullName || !phone) {
    throw new AppError("El nombre y el teléfono son obligatorios.", 400);
  }

  const trimmedPhone = String(phone).trim();
  if (!trimmedPhone) {
    throw new AppError("Teléfono no válido.", 400);
  }

  const existing = await prisma.lead.findFirst({ where: { phone: trimmedPhone } });
  if (existing) {
    throw new AppError("Este contacto ya existe.", 409);
  }

  const refId =
    referredByLeadId === undefined || referredByLeadId === null || referredByLeadId === ""
      ? null
      : String(referredByLeadId).trim();
  if (refId) {
    await assertReferrerLeadValid(refId, null);
  }

  const categoryId = await assertServiceCategoryValid(serviceCategoryId);

  const now = new Date();

  let parsedNextAction = null;
  if (nextActionDate !== undefined && nextActionDate !== null && nextActionDate !== "") {
    const parsed = parseDateInputToStartOfDay(nextActionDate);
    if (!parsed) {
      throw new AppError("Fecha de próxima acción no válida.", 400);
    }
    parsedNextAction = parsed;
  }

  const lead = await prisma.lead.create({
    data: {
      fullName: String(fullName).trim(),
      phone: trimmedPhone,
      email: email ? String(email).trim().toLowerCase() : null,
      source: normalizeSource(source),
      serviceCategoryId: categoryId,
      referredBy: referredBy ? String(referredBy).trim() : null,
      referredByLeadId: refId,
      observations: observations ? String(observations).trim() : null,
      nextActionDate: parsedNextAction,
      status: LeadStatus.NEW,
      ownerId: userId,
      lastActivityAt: now,
      activities: {
        create: {
          userId,
          type: ActivityType.LEAD_CREATED,
          description: "Lead registrado en el sistema.",
          metadata: { status: LeadStatus.NEW }
        }
      }
    },
    select: {
      id: true,
      leadNumber: true,
      fullName: true,
      phone: true,
      email: true,
      source: true,
      referredBy: true,
      referredByLeadId: true,
      observations: true,
      status: true,
      nextActionDate: true,
      lastActivityAt: true,
      createdAt: true,
      serviceCategory: { select: SERVICE_CATEGORY_SELECT }
    }
  });

  return lead;
}

export async function updateLead({ leadId, userId, payload }) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  ensureLeadExists(lead);

  const nextRefId =
    payload.referredByLeadId === undefined
      ? lead.referredByLeadId
      : payload.referredByLeadId === null || payload.referredByLeadId === ""
        ? null
        : String(payload.referredByLeadId).trim();
  if (nextRefId) {
    await assertReferrerLeadValid(nextRefId, leadId);
  }

  let nextServiceCategoryId = lead.serviceCategoryId;
  if (payload.serviceCategoryId !== undefined) {
    nextServiceCategoryId = await assertServiceCategoryValid(payload.serviceCategoryId);
  }

  const next = {
    fullName:
      payload.fullName !== undefined
        ? String(payload.fullName).trim()
        : lead.fullName,
    email:
      payload.email !== undefined
        ? payload.email === null || payload.email === ""
          ? null
          : String(payload.email).trim().toLowerCase()
        : lead.email,
    source:
      payload.source !== undefined ? normalizeSource(payload.source) : lead.source,
    referredBy:
      payload.referredBy !== undefined
        ? payload.referredBy === null || payload.referredBy === ""
          ? null
          : String(payload.referredBy).trim()
        : lead.referredBy,
    referredByLeadId: nextRefId,
    observations:
      payload.observations !== undefined
        ? payload.observations === null || payload.observations === ""
          ? null
          : String(payload.observations).trim()
        : lead.observations,
    nextActionDate: (() => {
      if (payload.nextActionDate === undefined) return lead.nextActionDate;
      if (payload.nextActionDate === null || payload.nextActionDate === "") return null;
      const parsed = parseDateInputToStartOfDay(payload.nextActionDate);
      if (!parsed) {
        throw new AppError("Fecha de próxima acción no válida.", 400);
      }
      return parsed;
    })(),
    serviceCategoryId: nextServiceCategoryId
  };

  if (payload.phone !== undefined && String(payload.phone).trim() !== lead.phone) {
    throw new AppError("El teléfono no se puede modificar (identificador único del lead).", 400);
  }

  if (lead.status === LeadStatus.FOLLOW_UP) {
    if (!next.nextActionDate) {
      throw new AppError(
        "En seguimiento es obligatoria la próxima fecha de contacto (solo fecha).",
        400
      );
    }
    const changingDate =
      payload.nextActionDate !== undefined &&
      payload.nextActionDate !== null &&
      payload.nextActionDate !== "";
    if (changingDate) {
      assertMinSevenDaysFollowUp(startOfLocalDay(next.nextActionDate));
    }
  }

  const parts = [];
  if (next.fullName !== lead.fullName) {
    parts.push("Nombre del contacto actualizado");
  }
  if (next.email !== lead.email) {
    parts.push("Correo electrónico actualizado");
  }
  if (next.source !== lead.source) {
    parts.push("Fuente del lead actualizada");
  }
  if (next.serviceCategoryId !== lead.serviceCategoryId) {
    parts.push("Servicio del lead actualizado");
  }
  if (next.referredBy !== lead.referredBy) {
    parts.push("Texto de referido actualizado");
  }
  if (next.referredByLeadId !== lead.referredByLeadId) {
    parts.push(
      next.referredByLeadId ? "Referidor vinculado a otro lead" : "Referidor desvinculado"
    );
  }
  if (next.observations !== lead.observations) {
    parts.push("Observaciones actualizadas");
  }
  const prevNa = lead.nextActionDate ? lead.nextActionDate.toISOString() : null;
  const nextNa = next.nextActionDate ? next.nextActionDate.toISOString() : null;
  if (prevNa !== nextNa) {
    parts.push("Fecha de próximo seguimiento ajustada");
  }

  if (parts.length === 0) {
    return await getLeadById(leadId);
  }

  const now = new Date();
  const description = `Se actualizó la ficha: ${parts.join(". ")}.`;

  await prisma.$transaction(async (tx) => {
    await tx.lead.update({
      where: { id: leadId },
      data: {
        fullName: next.fullName,
        email: next.email,
        source: next.source,
        serviceCategoryId: next.serviceCategoryId,
        referredBy: next.referredBy,
        referredByLeadId: next.referredByLeadId,
        observations: next.observations,
        nextActionDate: next.nextActionDate,
        lastActivityAt: now
      }
    });

    await tx.activity.create({
      data: {
        leadId,
        userId,
        type: ActivityType.LEAD_UPDATED,
        description,
        metadata: {
          fields: [
            "fullName",
            "email",
            "source",
            "serviceCategoryId",
            "referredBy",
            "referredByLeadId",
            "observations",
            "nextActionDate"
          ]
        }
      }
    });
  });

  return await getLeadById(leadId);
}

export async function getLeadById(id) {
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, name: true, email: true, role: true } },
      serviceCategory: { select: SERVICE_CATEGORY_SELECT },
      referredByLead: {
        select: { id: true, leadNumber: true, fullName: true, phone: true }
      },
      activities: {
        orderBy: { createdAt: "desc" },
        take: 200,
        include: { user: { select: { id: true, name: true, email: true } } }
      }
    }
  });

  ensureLeadExists(lead);
  return lead;
}

export async function changeLeadStatus({ leadId, userId, payload }) {
  const {
    status,
    noInvestmentReason,
    nextActionDate: nextActionRaw,
    followUpReason: followUpReasonRaw
  } = payload;

  if (!status) throw new AppError("El estado es obligatorio.", 400);
  if (!Object.prototype.hasOwnProperty.call(LeadStatus, status)) {
    throw new AppError("Estado no válido.", 400);
  }

  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  ensureLeadExists(lead);

  if (lead.status === status) {
    return await getLeadById(leadId);
  }

  validateStatusTransition(lead.status, status);

  if (status === LeadStatus.CLOSED_LOST) {
    const reason = noInvestmentReason ? String(noInvestmentReason).trim() : "";
    if (!reason) {
      throw new AppError("Debes indicar el motivo cuando el lead no se concreta.", 400);
    }
  }

  let followUpDate = null;
  let followUpReasonValue = null;
  if (status === LeadStatus.FOLLOW_UP) {
    if (!nextActionRaw) {
      throw new AppError(
        "Para seguimiento debes indicar la próxima fecha (solo día, al menos dentro de 7 días).",
        400
      );
    }
    followUpDate = parseDateInputToStartOfDay(nextActionRaw);
    if (!followUpDate) {
      throw new AppError("La fecha de seguimiento no es válida.", 400);
    }
    assertMinSevenDaysFollowUp(followUpDate);

    followUpReasonValue = normalizeFollowUpReason(followUpReasonRaw);
    if (!followUpReasonValue) {
      throw new AppError("Selecciona el motivo del seguimiento.", 400);
    }
  }

  let nextActionForLead = lead.nextActionDate;
  if (status === LeadStatus.FOLLOW_UP) {
    nextActionForLead = followUpDate;
  } else if (isClosedStatus(status) || lead.status === LeadStatus.FOLLOW_UP) {
    nextActionForLead = null;
  }

  // Limpiar motivo de seguimiento cuando el lead sale de FOLLOW_UP.
  const nextFollowUpReason =
    status === LeadStatus.FOLLOW_UP ? followUpReasonValue : null;

  const now = new Date();

  let nextClosedAt = lead.closedAt;
  if (isClosedStatus(status)) {
    nextClosedAt = now;
  } else if (isClosedStatus(lead.status)) {
    nextClosedAt = null;
  }

  let nextNoReason = lead.noInvestmentReason;
  if (status === LeadStatus.CLOSED_LOST) {
    nextNoReason = String(noInvestmentReason).trim();
  } else if (status === LeadStatus.CLOSED_SUCCESS) {
    nextNoReason = null;
  }

  const enteringFollowUp = status === LeadStatus.FOLLOW_UP;
  const nextFollowUpCount = enteringFollowUp
    ? (lead.followUpCount ?? 0) + 1
    : lead.followUpCount ?? 0;

  let statusDescription = formatStatusChangeDescription(lead.status, status);
  if (enteringFollowUp && followUpDate) {
    const human = formatSpanishDayMonthYear(followUpDate);
    const reasonLabel = followUpReasonLabelEs[followUpReasonValue] ?? "Motivo";
    statusDescription =
      `Lead enviado a seguimiento (#${nextFollowUpCount}) · ${reasonLabel}.\n` +
      `Próximo contacto programado para el ${human}.`;
  } else if (lead.status === LeadStatus.FOLLOW_UP) {
    statusDescription = `Lead reactivado desde seguimiento.\n${statusDescription}`;
  }

  await prisma.$transaction(async (tx) => {
    await tx.lead.update({
      where: { id: leadId },
      data: {
        status,
        closedAt: nextClosedAt,
        noInvestmentReason: nextNoReason,
        followUpReason: nextFollowUpReason,
        followUpCount: nextFollowUpCount,
        lastActivityAt: now,
        nextActionDate: nextActionForLead
      }
    });

    await tx.activity.create({
      data: {
        leadId,
        userId,
        type: ActivityType.STATUS_CHANGED,
        description: statusDescription,
        metadata: {
          from: lead.status,
          to: status,
          ...(enteringFollowUp && followUpDate
            ? {
                nextActionDate: followUpDate.toISOString(),
                followUpReason: followUpReasonValue,
                followUpCount: nextFollowUpCount
              }
            : {})
        }
      }
    });
  });

  return await getLeadById(leadId);
}

const quickFollowUpDays = new Set([7, 15, 30, 90]);

export async function applyFollowUpQuick({
  leadId,
  userId,
  days,
  nextActionDate: ymdCustom,
  followUpReason: followUpReasonRaw
}) {
  let target;
  if (ymdCustom !== undefined && ymdCustom !== null && String(ymdCustom).trim() !== "") {
    target = parseDateInputToStartOfDay(ymdCustom);
    if (!target) {
      throw new AppError("La fecha de seguimiento no es válida.", 400);
    }
    assertMinSevenDaysFollowUp(target);
  } else {
    const n = Number(days);
    if (!quickFollowUpDays.has(n)) {
      throw new AppError("Indica 7, 15, 30 o 90 días, o una fecha personalizada.", 400);
    }
    target = followUpDateAfterCalendarDays(n);
    assertMinSevenDaysFollowUp(target);
  }

  const ymd = toYmdLocal(target);

  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  ensureLeadExists(lead);

  const reasonValue = normalizeFollowUpReason(followUpReasonRaw);

  if (lead.status === LeadStatus.FOLLOW_UP) {
    if (!reasonValue) {
      throw new AppError("Selecciona el motivo del seguimiento.", 400);
    }
    const prevIso = lead.nextActionDate ? startOfLocalDay(lead.nextActionDate).toISOString() : null;
    const nextIso = target.toISOString();
    const sameDate = prevIso === nextIso;
    const sameReason = lead.followUpReason === reasonValue;
    if (sameDate && sameReason) {
      return getLeadById(leadId);
    }
    const human = formatSpanishDayMonthYear(target);
    const reasonLabel = followUpReasonLabelEs[reasonValue] ?? "Motivo";
    const count = lead.followUpCount ?? 0;
    const tag = count > 0 ? ` (#${count})` : "";
    const description = sameDate
      ? `Motivo de seguimiento actualizado${tag} · ${reasonLabel}.`
      : `Seguimiento reprogramado${tag} para el ${human} · ${reasonLabel}.`;
    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.lead.update({
        where: { id: leadId },
        data: {
          nextActionDate: target,
          followUpReason: reasonValue,
          lastActivityAt: now
        }
      });
      await tx.activity.create({
        data: {
          leadId,
          userId,
          type: ActivityType.LEAD_UPDATED,
          description,
          metadata: {
            action: "FOLLOW_UP_RESCHEDULE",
            nextActionDate: target.toISOString(),
            followUpReason: reasonValue
          }
        }
      });
    });
    return getLeadById(leadId);
  }

  validateStatusTransition(lead.status, LeadStatus.FOLLOW_UP);
  return changeLeadStatus({
    leadId,
    userId,
    payload: {
      status: LeadStatus.FOLLOW_UP,
      nextActionDate: ymd,
      followUpReason: reasonValue
    }
  });
}

export async function addLeadActivity({ leadId, userId, payload }) {
  const { type, description, metadata } = payload;

  if (!type || !description) {
    throw new AppError("El tipo y la descripción son obligatorios.", 400);
  }

  if (!Object.prototype.hasOwnProperty.call(ActivityType, type)) {
    throw new AppError("Tipo de actividad no válido.", 400);
  }

  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  ensureLeadExists(lead);

  const now = new Date();

  const activity = await prisma.$transaction(async (tx) => {
    const created = await tx.activity.create({
      data: {
        leadId,
        userId,
        type,
        description: String(description).trim(),
        metadata: metadata ?? null
      },
      include: { user: { select: { id: true, name: true, email: true } } }
    });

    await tx.lead.update({
      where: { id: leadId },
      data: { lastActivityAt: now }
    });

    return created;
  });

  return activity;
}
