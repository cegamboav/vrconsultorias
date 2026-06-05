import { prisma, ActivityType } from "@crm/database";
import { AppError } from "../utils/app-error.js";
import { addLeadActivity } from "./leads.service.js";
import { formatShortDateEs } from "./lead-timeline.service.js";

const NOTA_DESCRIPTION_PREFIX = "NOTA\n";

/** Texto visible en timeline para una nota del asistente. */
export function formatAssistantNoteDescription(noteText) {
  const note = String(noteText ?? "").trim();
  return `${NOTA_DESCRIPTION_PREFIX}${note}`;
}

/** Extrae el contenido de una actividad NOTE_ADDED (description o metadata). */
export function readNoteTextFromActivity(activity) {
  const meta = activity?.metadata;
  if (meta && typeof meta === "object" && !Array.isArray(meta) && meta.note) {
    return String(meta.note).trim();
  }

  const raw = String(activity?.description ?? "").trim();
  if (!raw) return "";

  const notaMatch = /^NOTA\s*\n([\s\S]+)$/i.exec(raw);
  if (notaMatch) {
    return notaMatch[1].trim();
  }

  return raw
    .replace(/^\[Asistente\]\s*/i, "")
    .replace(/^Nota agregada por asistente\.?$/i, "")
    .replace(/^Nota agregada:\s*/i, "")
    .trim();
}

function readNoteText(activity) {
  return readNoteTextFromActivity(activity);
}

/**
 * @param {string} leadId
 */
export async function getLeadNotesByLeadId(leadId) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, leadNumber: true, fullName: true }
  });

  if (!lead) {
    throw new AppError("Lead no encontrado.", 404);
  }

  const activities = await prisma.activity.findMany({
    where: {
      leadId,
      type: ActivityType.NOTE_ADDED
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      description: true,
      metadata: true,
      createdAt: true,
      user: { select: { id: true, name: true } }
    }
  });

  const notes = activities.map((activity) => ({
    id: activity.id,
    text: readNoteText(activity),
    createdAt: activity.createdAt,
    createdAtLabel: formatShortDateEs(activity.createdAt),
    authorName: activity.user?.name ?? null
  }));

  return {
    leadId: lead.id,
    leadNumber: lead.leadNumber,
    fullName: lead.fullName,
    count: notes.length,
    notes
  };
}

/**
 * @param {{ fullName: string, notes: Array<{ createdAtLabel: string, text: string, authorName?: string|null }> }} params
 */
export function formatLeadNotesSummaryText({ fullName, notes }) {
  if (!notes.length) {
    return `${fullName} no tiene notas registradas en el timeline.`;
  }

  const lines = notes.map((note, index) => {
    const author = note.authorName ? ` (${note.authorName})` : "";
    return `${index + 1}. ${note.createdAtLabel}${author}: ${note.text}`;
  });

  return `Notas de ${fullName} (${notes.length}):\n${lines.join("\n")}`;
}

/**
 * Registra una nota comercial vía asistente.
 * @param {{ leadId: string, userId: string, note: string, assistantAction?: string }} params
 */
export async function addAssistantLeadNote({
  leadId,
  userId,
  note,
  assistantAction = "ADD_LEAD_NOTE"
}) {
  const noteText = String(note ?? "").trim();
  if (!noteText) {
    throw new AppError("La nota no puede estar vacía.", 400);
  }

  return addLeadActivity({
    leadId,
    userId,
    payload: {
      type: ActivityType.NOTE_ADDED,
      description: formatAssistantNoteDescription(noteText),
      metadata: {
        source: "assistant",
        note: noteText,
        assistantAction
      }
    }
  });
}
