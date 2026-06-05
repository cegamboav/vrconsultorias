import { prisma, ActivityType, LeadStatus } from "@crm/database";
import { AppError } from "../utils/app-error.js";
import {
  followUpReasonLabelEs,
  leadSourceLabelEs,
  statusChangeTimelineLabelEs
} from "../constants/lead-copy.es.js";
import { readNoteTextFromActivity } from "./lead-notes.service.js";

const MAX_RESUME_NOTES = 10;

const LEAD_RESUME_SELECT = {
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
  noInvestmentReason: true,
  serviceCategory: {
    select: { id: true, name: true, slug: true, color: true }
  }
};

/** Fecha corta para resumen ejecutivo (ej. 30 jun 2026). */
export function formatResumeDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return d
    .toLocaleDateString("es-CR", {
      day: "numeric",
      month: "short",
      year: "numeric"
    })
    .replace(/\./g, "");
}

function ensureLeadRow(lead) {
  if (!lead) throw new AppError("Lead no encontrado.", 404);
  return lead;
}

/**
 * @param {Array<{ text: string }>} notes
 * @param {{ status: string, followUpReason?: string|null, followUpCount?: number, noInvestmentReason?: string|null, serviceCategory?: { name?: string }|null }} lead
 */
export function buildCommercialSummary(lead, notes) {
  const parts = [];
  const serviceName = lead.serviceCategory?.name ?? "el servicio";

  if (lead.status === LeadStatus.CLOSED_SUCCESS) {
    const followUps = lead.followUpCount ?? 0;
    if (followUps >= 2) {
      parts.push(
        `Lead concretado exitosamente después de ${followUps} seguimiento(s).`
      );
    } else {
      parts.push("Lead concretado exitosamente.");
    }
    return parts.join(" ");
  }

  if (lead.status === LeadStatus.CLOSED_LOST) {
    parts.push("Lead cerrado como no concretado.");
    if (lead.noInvestmentReason) {
      parts.push(String(lead.noInvestmentReason).trim());
    }
    return parts.join(" ");
  }

  if (notes.length > 0) {
    const texts = notes.map((n) => String(n.text ?? "").toLowerCase());
    const joined = texts.join(" ");

    if (/interés|interesad|propuesta|servicio/.test(joined)) {
      parts.push(`Mostró interés en el servicio de ${serviceName.toLowerCase()}.`);
    }

    if (lead.status === LeadStatus.FOLLOW_UP) {
      const reasonLabel = lead.followUpReason
        ? followUpReasonLabelEs[lead.followUpReason]
        : null;
      if (reasonLabel) {
        parts.push(`Actualmente se encuentra en seguimiento por ${reasonLabel.toLowerCase()}.`);
      } else {
        parts.push("Actualmente se encuentra en seguimiento.");
      }
    }

    if (/liquidez|dinero|herencia|presupuesto/.test(joined)) {
      parts.push("Las notas mencionan limitaciones de liquidez o espera de recursos.");
    }

    if (/esposo|esposa|familia|revisar|evaluar|alternativ|pensar/.test(joined)) {
      parts.push("Existen indicaciones de que está evaluando la decisión antes de avanzar.");
    }

    if (/contactar|llamar|semana|próxim/.test(joined)) {
      parts.push("Hay intención de retomar contacto en un plazo cercano.");
    }

    if (parts.length === 0 || parts.length === 1) {
      parts.push(
        `Existen ${notes.length} nota(s) con contexto comercial relevante para el seguimiento.`
      );
    }
  } else if (lead.status === LeadStatus.FOLLOW_UP) {
    const reasonLabel = lead.followUpReason
      ? followUpReasonLabelEs[lead.followUpReason]
      : null;
    parts.push(
      reasonLabel
        ? `Lead en seguimiento por ${reasonLabel.toLowerCase()}.`
        : "Lead en seguimiento activo."
    );
  } else if (lead.status === LeadStatus.NEW || lead.status === LeadStatus.CONTACTED) {
    parts.push("Lead en etapa inicial de contacto comercial.");
  } else if (lead.status === LeadStatus.SCHEDULED) {
    parts.push("Lead con cita o reunión programada.");
  }

  if (parts.length === 0) {
    parts.push("Sin contexto comercial adicional registrado en notas.");
  }

  return parts.join(" ");
}

/**
 * @param {object} resume
 */
export function formatLeadResumeText(resume) {
  const lines = [resume.fullName, ""];

  lines.push("Servicio:", resume.service ?? "Sin servicio asignado", "");
  lines.push("Estado actual:", resume.statusLabel, "");

  if (resume.followUpReasonLabel) {
    lines.push("Motivo seguimiento:", resume.followUpReasonLabel, "");
  }

  if (resume.nextActionDateLabel) {
    lines.push("Próxima acción:", resume.nextActionDateLabel, "");
  }

  lines.push("Creado:", resume.createdAtLabel, "");
  lines.push("Fuente:", resume.sourceLabel, "");

  lines.push("Notas relevantes:", "");
  if (resume.notes.length === 0) {
    lines.push("(Sin notas registradas)", "");
  } else {
    for (const note of resume.notes) {
      lines.push(`• ${note.text}`);
    }
    lines.push("");
  }

  if (resume.lastActivityAtLabel) {
    lines.push("Última actividad:", resume.lastActivityAtLabel, "");
  }

  lines.push("Resumen comercial:", "", resume.commercialSummary);

  return lines.join("\n").trim();
}

/**
 * @param {string} leadId
 */
export async function getLeadResumeByLeadId(leadId) {
  const lead = ensureLeadRow(
    await prisma.lead.findUnique({
      where: { id: leadId },
      select: LEAD_RESUME_SELECT
    })
  );

  const noteActivities = await prisma.activity.findMany({
    where: { leadId, type: ActivityType.NOTE_ADDED },
    orderBy: { createdAt: "desc" },
    take: MAX_RESUME_NOTES,
    select: {
      id: true,
      description: true,
      metadata: true,
      createdAt: true,
      user: { select: { id: true, name: true } }
    }
  });

  const notes = noteActivities.map((activity) => ({
    id: activity.id,
    text: readNoteTextFromActivity(activity),
    createdAt: activity.createdAt,
    createdAtLabel: formatResumeDate(activity.createdAt),
    authorName: activity.user?.name ?? null
  }));

  const lastActivity = await prisma.activity.findFirst({
    where: { leadId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      type: true,
      description: true,
      createdAt: true
    }
  });

  const statusLabel = statusChangeTimelineLabelEs[lead.status] ?? lead.status;
  const followUpReasonLabel = lead.followUpReason
    ? followUpReasonLabelEs[lead.followUpReason]
    : null;

  const resume = {
    action: "RESUME_LEAD",
    leadId: lead.id,
    leadNumber: lead.leadNumber,
    fullName: lead.fullName,
    phone: lead.phone,
    email: lead.email ?? null,
    service: lead.serviceCategory?.name ?? null,
    status: lead.status,
    statusLabel,
    source: lead.source,
    sourceLabel: leadSourceLabelEs[lead.source] ?? lead.source,
    followUpReason: lead.followUpReason ?? null,
    followUpReasonLabel,
    followUpCount: lead.followUpCount ?? 0,
    nextActionDate: lead.nextActionDate ? lead.nextActionDate.toISOString() : null,
    nextActionDateLabel: lead.nextActionDate ? formatResumeDate(lead.nextActionDate) : null,
    createdAt: lead.createdAt.toISOString(),
    createdAtLabel: formatResumeDate(lead.createdAt),
    lastActivityAt: lead.lastActivityAt ? lead.lastActivityAt.toISOString() : null,
    lastActivityAtLabel: lead.lastActivityAt ? formatResumeDate(lead.lastActivityAt) : null,
    noInvestmentReason: lead.noInvestmentReason ?? null,
    notes,
    activities: lastActivity
      ? [
          {
            id: lastActivity.id,
            type: lastActivity.type,
            description: lastActivity.description,
            createdAt: lastActivity.createdAt.toISOString(),
            createdAtLabel: formatResumeDate(lastActivity.createdAt)
          }
        ]
      : [],
    commercialSummary: buildCommercialSummary(lead, notes)
  };

  resume.summaryText = formatLeadResumeText(resume);

  return resume;
}

export function buildResumeLeadDisambiguationReply(candidates) {
  const list = (candidates ?? []).map((c, i) => `${i + 1}. ${c.fullName}`);
  if (list.length === 0) {
    return "Encontré varias coincidencias. Indica el nombre completo del lead.";
  }
  return `Encontré varias coincidencias:\n\n${list.join("\n")}\n\n¿De cuál deseas el resumen?`;
}
