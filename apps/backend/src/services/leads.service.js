import { prisma, ActivityType, LeadSource, LeadStatus } from "@crm/database";
import { AppError } from "../utils/app-error.js";

const allowedTransitions = {
  NEW: ["CONTACTED"],
  CONTACTED: ["RESPONDED"],
  RESPONDED: ["SCHEDULED"],
  SCHEDULED: ["CLOSED"],
  CLOSED: []
};

function ensureLeadExists(lead) {
  if (!lead) throw new AppError("Lead no encontrado.", 404);
}

function normalizeSource(source) {
  if (!source) return LeadSource.OTHER;
  if (!Object.prototype.hasOwnProperty.call(LeadSource, source)) return LeadSource.OTHER;
  return source;
}

function validateStatusTransition(currentStatus, nextStatus) {
  const allowed = allowedTransitions[currentStatus] ?? [];
  if (!allowed.includes(nextStatus)) {
    throw new AppError(
      `Transición inválida: ${currentStatus} → ${nextStatus}.`,
      400
    );
  }
}

export async function listLeads() {
  const leads = await prisma.lead.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      leadNumber: true,
      fullName: true,
      phone: true,
      email: true,
      source: true,
      status: true,
      nextActionDate: true,
      lastActivityAt: true,
      createdAt: true,
      updatedAt: true
    }
  });

  return leads;
}

export async function createLead({ userId, payload }) {
  const { fullName, phone, email, source, referredBy, observations } = payload;

  if (!fullName || !phone) {
    throw new AppError("fullName y phone son requeridos.", 400);
  }

  const trimmedPhone = String(phone).trim();
  if (!trimmedPhone) {
    throw new AppError("phone inválido.", 400);
  }

  const existing = await prisma.lead.findFirst({ where: { phone: trimmedPhone } });
  if (existing) {
    throw new AppError("Este contacto ya existe.", 409);
  }

  const now = new Date();

  const lead = await prisma.lead.create({
    data: {
      fullName: String(fullName).trim(),
      phone: trimmedPhone,
      email: email ? String(email).trim().toLowerCase() : null,
      source: normalizeSource(source),
      referredBy: referredBy ? String(referredBy).trim() : null,
      observations: observations ? String(observations).trim() : null,
      status: LeadStatus.NEW,
      ownerId: userId,
      lastActivityAt: now,
      activities: {
        create: {
          userId,
          type: ActivityType.LEAD_CREATED,
          description: "Lead creado",
          metadata: {
            status: "NEW"
          }
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
      status: true,
      lastActivityAt: true,
      createdAt: true
    }
  });

  return lead;
}

export async function getLeadById(id) {
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, name: true, email: true, role: true } },
      activities: {
        orderBy: { createdAt: "desc" },
        include: { user: { select: { id: true, name: true, email: true } } }
      }
    }
  });

  ensureLeadExists(lead);
  return lead;
}

export async function changeLeadStatus({ leadId, userId, payload }) {
  const { status, closeSubstatus, noInvestmentReason } = payload;

  if (!status) throw new AppError("status es requerido.", 400);
  if (!Object.prototype.hasOwnProperty.call(LeadStatus, status)) {
    throw new AppError("status inválido.", 400);
  }

  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  ensureLeadExists(lead);

  if (lead.status === status) {
    return await getLeadById(leadId);
  }

  validateStatusTransition(lead.status, status);

  const closing = status === LeadStatus.CLOSED;
  if (closing && !closeSubstatus) {
    throw new AppError("closeSubstatus es requerido para cerrar un lead.", 400);
  }

  const notInvested =
    closeSubstatus === "NOT_INVESTED_TEMPORARY" || closeSubstatus === "NOT_INVESTED_FINAL";
  if (closing && notInvested && !noInvestmentReason) {
    throw new AppError("noInvestmentReason es requerido si no invirtió.", 400);
  }

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.lead.update({
      where: { id: leadId },
      data: {
        status,
        closeSubstatus: closing ? closeSubstatus : null,
        noInvestmentReason: closing ? (notInvested ? noInvestmentReason : null) : null,
        closedAt: closing ? now : null,
        lastActivityAt: now
      }
    });

    await tx.activity.create({
      data: {
        leadId,
        userId,
        type: ActivityType.STATUS_CHANGED,
        description: `Cambio de estado: ${lead.status} → ${status}`,
        metadata: {
          from: lead.status,
          to: status,
          closeSubstatus: closing ? closeSubstatus : null
        }
      }
    });
  });

  return await getLeadById(leadId);
}

export async function addLeadActivity({ leadId, userId, payload }) {
  const { type, description, metadata } = payload;

  if (!type || !description) {
    throw new AppError("type y description son requeridos.", 400);
  }

  if (!Object.prototype.hasOwnProperty.call(ActivityType, type)) {
    throw new AppError("type inválido.", 400);
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

