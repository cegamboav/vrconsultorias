import { prisma } from "@crm/database";
import { AppError } from "../utils/app-error.js";
import {
  followUpReasonLabelEs,
  statusChangeTimelineLabelEs
} from "../constants/lead-copy.es.js";

const LEAD_TIMELINE_SELECT = {
  id: true,
  leadNumber: true,
  fullName: true,
  status: true,
  nextActionDate: true,
  createdAt: true,
  serviceCategory: {
    select: { id: true, name: true, slug: true, color: true }
  }
};

const RELEVANT_ACTIVITY_TYPES = [
  "LEAD_CREATED",
  "STATUS_CHANGED",
  "NOTE_ADDED",
  "REMINDER_CREATED",
  "MEETING_SCHEDULED",
  "LEAD_REACTIVATED",
  "LEAD_CLOSED"
];

function ensureLeadRow(lead) {
  if (!lead) throw new AppError("Lead no encontrado.", 404);
  return lead;
}

/** Fecha corta DD/MM/YYYY en calendario local. */
export function formatShortDateEs(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function readMetadata(metadata) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }
  return metadata;
}

function firstLine(text) {
  return String(text ?? "")
    .trim()
    .split("\n")[0]
    .trim();
}

function readNoteTextForTimeline(activity) {
  const meta = readMetadata(activity.metadata);
  if (meta.note) {
    return String(meta.note).trim();
  }
  const raw = String(activity.description ?? "").trim();
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

/**
 * @param {{ type: string, description: string, metadata?: object|null, createdAt: Date }} activity
 * @returns {string[]}
 */
export function formatActivityToTimelineBullets(activity) {
  const date = formatShortDateEs(activity.createdAt);
  const raw = String(activity.description ?? "").trim();
  const meta = readMetadata(activity.metadata);

  switch (activity.type) {
    case "LEAD_CREATED":
      return [`Lead creado el ${date}.`];

    case "STATUS_CHANGED": {
      const bullets = [];
      const to = meta.to ? String(meta.to) : null;
      const line = firstLine(raw);
      const statusMatch = /^Se cambió el estado a (.+?)\.?$/i.exec(line);

      if (to === "FOLLOW_UP") {
        if (meta.followUpReason) {
          const reasonKey = String(meta.followUpReason);
          const reasonLabel = followUpReasonLabelEs[reasonKey] ?? reasonKey;
          bullets.push(`Enviado a Seguimiento (${reasonLabel}).`);
        } else {
          bullets.push("Enviado a Seguimiento.");
        }

        if (meta.nextActionDate) {
          const actionDate = formatShortDateEs(meta.nextActionDate);
          if (actionDate) {
            bullets.push(`Próxima acción programada para el ${actionDate}.`);
          }
        }
      } else if (statusMatch) {
        bullets.push(`Estado cambiado a ${statusMatch[1].trim()}.`);
      } else if (line) {
        bullets.push(line.endsWith(".") ? line : `${line}.`);
      }

      return bullets.length > 0 ? bullets : [`Cambio de estado el ${date}.`];
    }

    case "NOTE_ADDED": {
      const noteText = readNoteTextForTimeline(activity);
      if (!noteText) {
        return [`Nota agregada el ${date}.`];
      }
      return [noteText.endsWith(".") ? noteText : `${noteText}.`];
    }

    case "REMINDER_CREATED":
      return [raw ? `Recordatorio creado: ${raw.replace(/\.$/, "")}.` : `Recordatorio creado el ${date}.`];

    case "MEETING_SCHEDULED":
      return [raw ? `Reunión agendada: ${raw.replace(/\.$/, "")}.` : `Reunión agendada el ${date}.`];

    case "LEAD_REACTIVATED": {
      const line = firstLine(raw);
      return [line.endsWith(".") ? line : `${line}.`];
    }

    case "LEAD_CLOSED": {
      const line = firstLine(raw);
      return [line ? (line.endsWith(".") ? line : `${line}.`) : `Lead cerrado el ${date}.`];
    }

    default:
      return [];
  }
}

/**
 * @param {object} lead
 * @param {object[]} activities
 */
export function buildLeadTimelineSummary(lead, activities) {
  const statusLabel = statusChangeTimelineLabelEs[lead.status] ?? lead.status;
  const currentStatusLine = `Estado actual: ${statusLabel}.`;

  if (!activities.length) {
    return {
      fullName: lead.fullName,
      leadNumber: lead.leadNumber,
      status: lead.status,
      statusLabel,
      service: lead.serviceCategory?.name ?? null,
      hasHistory: false,
      bullets: [],
      currentStatusLine,
      summaryText: "El lead existe pero todavía no tiene historial registrado."
    };
  }

  const bullets = [];
  for (const activity of activities) {
    bullets.push(...formatActivityToTimelineBullets(activity));
  }

  const summaryText = [lead.fullName, ...bullets.map((b) => `• ${b}`), currentStatusLine].join(
    "\n"
  );

  return {
    fullName: lead.fullName,
    leadNumber: lead.leadNumber,
    status: lead.status,
    statusLabel,
    service: lead.serviceCategory?.name ?? null,
    hasHistory: true,
    bullets,
    currentStatusLine,
    summaryText
  };
}

export async function getLeadTimelineSummaryByLeadId(leadId) {
  const lead = ensureLeadRow(
    await prisma.lead.findUnique({
      where: { id: leadId },
      select: LEAD_TIMELINE_SELECT
    })
  );

  const activities = await prisma.activity.findMany({
    where: {
      leadId,
      type: { in: RELEVANT_ACTIVITY_TYPES }
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      type: true,
      description: true,
      metadata: true,
      createdAt: true
    }
  });

  return buildLeadTimelineSummary(lead, activities);
}
