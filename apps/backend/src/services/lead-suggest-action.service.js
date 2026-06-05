import { prisma, ActivityType, LeadStatus } from "@crm/database";
import { AppError } from "../utils/app-error.js";
import {
  followUpReasonLabelEs,
  statusChangeTimelineLabelEs
} from "../constants/lead-copy.es.js";
import {
  calendarDaysFromTodayStart,
  startOfLocalDay
} from "../utils/follow-up-date.js";
import { readNoteTextFromActivity } from "./lead-notes.service.js";
import { formatResumeDate } from "./lead-resume.service.js";

const MAX_NOTES = 10;
const MAX_ACTIVITIES = 20;

const LEAD_SUGGEST_SELECT = {
  id: true,
  leadNumber: true,
  fullName: true,
  status: true,
  followUpReason: true,
  followUpCount: true,
  nextActionDate: true,
  lastActivityAt: true,
  createdAt: true,
  serviceCategory: {
    select: { id: true, name: true, slug: true }
  }
};

function ensureLeadRow(lead) {
  if (!lead) throw new AppError("Lead no encontrado.", 404);
  return lead;
}

function isActionDueSoon(nextActionDate) {
  if (!nextActionDate) return false;
  const offset = calendarDaysFromTodayStart(startOfLocalDay(nextActionDate));
  return offset <= 0;
}

/**
 * @param {object} lead
 * @param {Array<{ text: string }>} [notes]
 */
export function buildSuggestRecommendation(lead, notes = []) {
  const { status, followUpReason } = lead;

  if (status === LeadStatus.FOLLOW_UP) {
    switch (followUpReason) {
      case "BUSY":
        if (isActionDueSoon(lead.nextActionDate)) {
          return "Contactarlo para validar si ya dispone de tiempo para retomar la conversación y determinar si el interés continúa vigente.";
        }
        return "Contactar nuevamente cuando se acerque la fecha programada para validar disponibilidad.";
      case "NO_MONEY":
        return "Validar si la situación económica cambió y si existe interés activo.";
      case "THINKING":
        return "Contactar para resolver dudas y ayudar a tomar una decisión.";
      case "NO_RESPONSE":
        return "Intentar contacto por otro canal y confirmar si mantiene interés en el servicio.";
      case "CALL_LATER":
        return "Contactar en la fecha acordada y retomar la conversación comercial.";
      default:
        return "Dar seguimiento en la fecha programada y actualizar el estado del lead.";
    }
  }

  if (status === LeadStatus.CONTACTED) {
    return "Realizar seguimiento para confirmar interés y próximos pasos.";
  }

  if (status === LeadStatus.NEW) {
    const daysSinceCreated = lead.createdAt
      ? calendarDaysFromTodayStart(startOfLocalDay(lead.createdAt)) * -1
      : 0;
    if (daysSinceCreated > 3) {
      return "Realizar primer contacto comercial cuanto antes; el lead lleva varios días sin contacto.";
    }
    return "Realizar primer contacto comercial.";
  }

  if (status === LeadStatus.SCHEDULED) {
    if (isActionDueSoon(lead.nextActionDate)) {
      return "Confirmar asistencia de inmediato y preparar la reunión con información del servicio.";
    }
    return "Confirmar asistencia y preparar reunión.";
  }

  if (status === LeadStatus.CLOSED_SUCCESS) {
    return "No requiere seguimiento comercial. Evaluar oportunidades de referidos o venta cruzada.";
  }

  if (status === LeadStatus.CLOSED_LOST) {
    return "No requiere seguimiento activo. Revisar posibilidad de reactivación futura.";
  }

  return "Revisar el estado del lead y definir el siguiente paso comercial.";
}

/**
 * @param {{ lead: object, notes: Array<{ text: string }>, activities: object[] }} params
 */
export function buildSuggestRationale({ lead, notes, activities }) {
  const parts = [];

  if ((lead.followUpCount ?? 0) >= 2) {
    parts.push(`El lead acumula ${lead.followUpCount} seguimiento(s) previo(s).`);
  }

  if (lead.nextActionDate) {
    const dayOffset = calendarDaysFromTodayStart(startOfLocalDay(lead.nextActionDate));
    if (dayOffset < 0) {
      const days = Math.abs(dayOffset);
      parts.push(
        `La próxima acción está vencida hace ${days} ${days === 1 ? "día" : "días"}.`
      );
    } else if (dayOffset === 0) {
      parts.push("La próxima acción está programada para hoy.");
    } else if (dayOffset <= 7) {
      parts.push(`La próxima acción está programada en ${dayOffset} día(s).`);
    }
  }

  if (notes.length > 0) {
    const joined = notes.map((n) => String(n.text ?? "").toLowerCase()).join(" ");
    parts.push(`Se analizaron ${notes.length} nota(s) reciente(s).`);
    if (/interés|interesad|propuesta/.test(joined)) {
      parts.push("Las notas registran interés comercial.");
    }
    if (/liquidez|dinero|presupuesto|herencia/.test(joined)) {
      parts.push("Las notas mencionan limitaciones o expectativas económicas.");
    }
    if (/esposo|esposa|familia|evaluar|pensar/.test(joined)) {
      parts.push("Las notas sugieren que está evaluando la decisión.");
    }
  } else if (activities.length === 0) {
    parts.push("El lead tiene poco historial registrado en el CRM.");
  }

  if (lead.lastActivityAt) {
    const daysSinceActivity = Math.round(
      (startOfLocalDay(new Date()).getTime() -
        startOfLocalDay(lead.lastActivityAt).getTime()) /
        86400000
    );
    if (daysSinceActivity > 14) {
      parts.push("No hay actividad reciente en más de dos semanas.");
    }
  }

  if (parts.length === 0) {
    parts.push("La recomendación se basa en el estado actual del lead en el pipeline.");
  }

  return parts.join(" ");
}

/**
 * @param {object} result
 */
export function formatSuggestNextActionText(result) {
  const lines = [result.fullName, ""];

  lines.push("Estado:", result.statusLabel, "");

  if (result.followUpReasonLabel) {
    lines.push("Motivo:", result.followUpReasonLabel, "");
  }

  if (result.nextActionDateLabel) {
    lines.push("Próxima acción:", result.nextActionDateLabel, "");
  }

  lines.push("Recomendación:", "", result.recommendation);

  if (result.rationale) {
    lines.push("", "Justificación:", "", result.rationale);
  }

  return lines.join("\n").trim();
}

export function buildSuggestNextActionDisambiguationReply(candidates) {
  const list = (candidates ?? []).map((c, i) => `${i + 1}. ${c.fullName}`);
  if (list.length === 0) {
    return "Encontré varias coincidencias. Indica el nombre completo del lead.";
  }
  return `Encontré varias coincidencias:\n\n${list.join("\n")}\n\n¿De cuál deseas la recomendación?`;
}

/**
 * @param {string} leadId
 */
export async function getSuggestedNextActionByLeadId(leadId) {
  const lead = ensureLeadRow(
    await prisma.lead.findUnique({
      where: { id: leadId },
      select: LEAD_SUGGEST_SELECT
    })
  );

  const noteActivities = await prisma.activity.findMany({
    where: { leadId, type: ActivityType.NOTE_ADDED },
    orderBy: { createdAt: "desc" },
    take: MAX_NOTES,
    select: {
      id: true,
      description: true,
      metadata: true,
      createdAt: true
    }
  });

  const activities = await prisma.activity.findMany({
    where: { leadId },
    orderBy: { createdAt: "desc" },
    take: MAX_ACTIVITIES,
    select: {
      id: true,
      type: true,
      description: true,
      createdAt: true
    }
  });

  const notes = noteActivities.map((activity) => ({
    id: activity.id,
    text: readNoteTextFromActivity(activity),
    createdAt: activity.createdAt
  }));

  const statusLabel = statusChangeTimelineLabelEs[lead.status] ?? lead.status;
  const followUpReasonLabel = lead.followUpReason
    ? followUpReasonLabelEs[lead.followUpReason]
    : null;

  const recommendation = buildSuggestRecommendation(lead, notes);
  const rationale = buildSuggestRationale({ lead, notes, activities });

  const result = {
    action: "SUGGEST_NEXT_ACTION",
    leadId: lead.id,
    leadNumber: lead.leadNumber,
    fullName: lead.fullName,
    status: lead.status,
    statusLabel,
    followUpReason: lead.followUpReason ?? null,
    followUpReasonLabel,
    followUpCount: lead.followUpCount ?? 0,
    nextActionDate: lead.nextActionDate ? lead.nextActionDate.toISOString() : null,
    nextActionDateLabel: lead.nextActionDate ? formatResumeDate(lead.nextActionDate) : null,
    recommendation,
    rationale,
    notesAnalyzed: notes.length,
    activitiesAnalyzed: activities.length
  };

  result.summaryText = formatSuggestNextActionText(result);

  return result;
}
