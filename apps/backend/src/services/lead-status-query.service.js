import { LeadStatus } from "@crm/database";
import { statusChangeTimelineLabelEs, spanishStatusLabelToEnum } from "../constants/lead-copy.es.js";

/** Estados considerados "abiertos" (pipeline activo). */
export const OPEN_LEAD_STATUSES = [
  LeadStatus.NEW,
  LeadStatus.CONTACTED,
  LeadStatus.SCHEDULED,
  LeadStatus.FOLLOW_UP
];

const STATUS_SCOPE_OPEN = "OPEN";

/**
 * @typedef {{ statuses: string[], statusLabel: string|null, listTitle: string, countLabel: string, isOpen: boolean }} StatusQueryFilter
 */

/**
 * Resuelve filtro de estado desde interpretación (y opcionalmente mensaje del usuario).
 * @param {object} interpretation
 * @param {string|null} [userMessage]
 * @returns {StatusQueryFilter|null}
 */
export function resolveLeadStatusQueryFilter(interpretation = {}, userMessage = null) {
  const scope = String(interpretation.statusScope ?? interpretation.scope ?? "")
    .trim()
    .toUpperCase();

  if (scope === STATUS_SCOPE_OPEN) {
    return buildOpenFilter();
  }

  const statusKey = normalizeStatusKey(interpretation.status);
  if (statusKey) {
    return buildSingleStatusFilter(statusKey);
  }

  const fromMessage = inferStatusFilterFromMessage(userMessage);
  if (fromMessage) {
    return fromMessage;
  }

  return null;
}

function normalizeStatusKey(raw) {
  const key = String(raw ?? "")
    .trim()
    .toUpperCase();
  if (!key) return null;
  if (Object.prototype.hasOwnProperty.call(LeadStatus, key)) {
    return LeadStatus[key];
  }
  return null;
}

function buildOpenFilter() {
  return {
    statuses: [...OPEN_LEAD_STATUSES],
    statusLabel: null,
    listTitle: "Leads abiertos",
    countLabel: "abiertos",
    isOpen: true
  };
}

function buildSingleStatusFilter(status) {
  const label = statusChangeTimelineLabelEs[status] ?? status;
  const labelLower = label.toLowerCase();
  return {
    statuses: [status],
    statusLabel: labelLower,
    listTitle: `Leads en ${labelLower}`,
    countLabel: labelLower,
    isOpen: false
  };
}

/**
 * Inferencia de respaldo cuando la IA no envía status/statusScope.
 * @param {string|null} message
 * @returns {StatusQueryFilter|null}
 */
export function inferStatusFilterFromMessage(message) {
  const text = String(message ?? "").trim().toLowerCase();
  if (!text) return null;

  if (/\b(abiertos?|abiertas?|en curso|activos?)\b/.test(text)) {
    return buildOpenFilter();
  }

  for (const [label, status] of Object.entries(spanishStatusLabelToEnum)) {
    if (text.includes(label)) {
      return buildSingleStatusFilter(status);
    }
  }

  if (/\bnuevos?\b/.test(text) || /\bestado nuevo\b/.test(text)) {
    return buildSingleStatusFilter(LeadStatus.NEW);
  }

  if (/\bconcretados?\b/.test(text)) {
    return buildSingleStatusFilter(LeadStatus.CLOSED_SUCCESS);
  }

  if (/\bno concretados?\b/.test(text)) {
    return buildSingleStatusFilter(LeadStatus.CLOSED_LOST);
  }

  return null;
}

/**
 * @param {number} count
 * @param {StatusQueryFilter} filter
 */
export function buildCountLeadsByStatusReply(count, filter) {
  const n = Number(count) || 0;

  if (filter.isOpen) {
    if (n === 0) return "No tienes leads abiertos.";
    if (n === 1) return "Tienes 1 lead abierto.";
    return `Tienes ${n} leads abiertos.`;
  }

  const label = filter.statusLabel ?? filter.countLabel;
  if (n === 0) return `No tienes leads en ${label}.`;
  if (n === 1) return `Tienes 1 lead en ${label}.`;
  return `Tienes ${n} leads en ${label}.`;
}

/**
 * @param {{ leads: Array<{ leadNumber: number, fullName: string }>, count: number, filter: StatusQueryFilter }} params
 */
export function buildListLeadsByStatusReply({ leads, count, filter }) {
  const n = Number(count) || 0;

  if (n === 0) {
    return `No hay ${filter.listTitle.toLowerCase()}.`;
  }

  const lines = (leads ?? []).map((l) => `#${l.leadNumber} ${l.fullName}`);
  const totalLine = filter.isOpen ? `Total abiertos: ${n}` : `Total: ${n}`;

  return `${filter.listTitle}:\n\n${lines.join("\n")}\n\n${totalLine}`;
}

/**
 * Respuesta cuando se pide conteo total sin filtro de estado.
 * @param {{ total: number, summary: Array<{ statusLabel: string, count: number }> }} data
 */
export function buildCountAllLeadsReply(data) {
  const parts = (data.summary ?? [])
    .filter((row) => row.count > 0)
    .map((row) => `${row.statusLabel}: ${row.count}`);
  const body = parts.length ? parts.join(", ") : "No hay leads registrados.";
  return `Tienes ${data.total ?? 0} leads en total. ${body}`;
}

export function buildListStatusClarification() {
  return "¿De qué estado quieres ver los leads? (nuevo, contactado, agendado, seguimiento, abiertos, concretado, no concretado)";
}
