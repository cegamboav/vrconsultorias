import { FollowUpReason, LeadStatus } from "@crm/database";
import { followUpReasonLabelEs } from "../constants/lead-copy.es.js";

/** Defaults comerciales cuando el intérprete no envía suggestedDays. */
export const SMART_FOLLOW_UP_DEFAULTS = {
  THINKING: { followUpReason: FollowUpReason.THINKING, suggestedDays: 15 },
  NO_MONEY: { followUpReason: FollowUpReason.NO_MONEY, suggestedDays: 30 },
  CALL_LATER: { followUpReason: FollowUpReason.CALL_LATER, suggestedDays: 7 },
  BUSY: { followUpReason: FollowUpReason.BUSY, suggestedDays: 7 }
};

const ALLOWED_TARGET_STATUSES = new Set([
  LeadStatus.FOLLOW_UP,
  LeadStatus.CLOSED_SUCCESS,
  LeadStatus.CLOSED_LOST,
  LeadStatus.SCHEDULED
]);

const QUICK_FOLLOW_UP_DAYS = new Set([7, 15, 30, 90]);

/**
 * @param {object} raw
 */
export function normalizeSmartStatusPayload(raw) {
  const targetStatus = raw?.targetStatus
    ? String(raw.targetStatus).trim().toUpperCase()
    : null;
  const followUpReason = raw?.followUpReason
    ? String(raw.followUpReason).trim().toUpperCase()
    : null;

  return {
    leadName: raw?.leadName ?? null,
    leadId: raw?.leadId ?? null,
    targetStatus,
    followUpReason,
    suggestedDays:
      raw?.suggestedDays !== undefined && raw?.suggestedDays !== null
        ? Number(raw.suggestedDays)
        : null,
    requiresClarification: Boolean(raw?.requiresClarification),
    clarification: raw?.clarification ?? null,
    noInvestmentReason: raw?.noInvestmentReason ?? null
  };
}

export function resolveSmartStatusClarification(payload) {
  if (!payload.requiresClarification) {
    return null;
  }
  return (
    payload.clarification ??
    (payload.targetStatus === LeadStatus.SCHEDULED
      ? `¿Para qué fecha deseas reprogramar a ${payload.leadName ?? "el lead"}?`
      : "Necesito un poco más de detalle para actualizar este lead.")
  );
}

export function resolveSmartFollowUpDays(payload) {
  const explicit = payload.suggestedDays;
  if (explicit !== null && !Number.isNaN(explicit) && QUICK_FOLLOW_UP_DAYS.has(explicit)) {
    return explicit;
  }

  const reasonKey = payload.followUpReason;
  if (reasonKey && Object.prototype.hasOwnProperty.call(SMART_FOLLOW_UP_DEFAULTS, reasonKey)) {
    return SMART_FOLLOW_UP_DEFAULTS[reasonKey].suggestedDays;
  }

  return 15;
}

export function resolveSmartFollowUpReason(payload) {
  const reasonKey = payload.followUpReason;
  if (reasonKey && Object.prototype.hasOwnProperty.call(FollowUpReason, reasonKey)) {
    return FollowUpReason[reasonKey];
  }

  if (reasonKey && Object.prototype.hasOwnProperty.call(SMART_FOLLOW_UP_DEFAULTS, reasonKey)) {
    return SMART_FOLLOW_UP_DEFAULTS[reasonKey].followUpReason;
  }

  return FollowUpReason.OTHER;
}

export function inferNoInvestmentReason(payload, userMessage) {
  const explicit = String(payload.noInvestmentReason ?? "").trim();
  if (explicit) return explicit;
  const fromMessage = String(userMessage ?? "").trim();
  if (fromMessage) return fromMessage.slice(0, 240);
  return "Decidió no continuar con el proceso comercial.";
}

export function validateSmartStatusPayload(payload) {
  if (!payload.targetStatus || !ALLOWED_TARGET_STATUSES.has(payload.targetStatus)) {
    return "No pude determinar el estado comercial objetivo.";
  }
  if (payload.targetStatus === LeadStatus.FOLLOW_UP) {
    const days = resolveSmartFollowUpDays(payload);
    if (!QUICK_FOLLOW_UP_DAYS.has(days)) {
      return "Los días de seguimiento deben ser 7, 15, 30 o 90.";
    }
  }
  return null;
}

export function buildSmartStatusTimelineSummary({ targetStatus, followUpReason }) {
  if (targetStatus === LeadStatus.CLOSED_SUCCESS) {
    return "Lead marcado como concretado.";
  }
  if (targetStatus === LeadStatus.CLOSED_LOST) {
    return "Lead marcado como no concretado.";
  }
  if (targetStatus === LeadStatus.FOLLOW_UP) {
    const label = followUpReasonLabelEs[followUpReason] ?? followUpReason ?? "Otro";
    return `Lead enviado a seguimiento por motivo ${label}.`;
  }
  return "Actualización comercial registrada vía asistente.";
}

export function buildSmartStatusAuditDescription({
  leadNumber,
  fullName,
  targetStatus,
  followUpReason,
  days
}) {
  if (targetStatus === LeadStatus.CLOSED_SUCCESS) {
    return `Lead #${leadNumber} (${fullName}) marcado como concretado vía asistente.`;
  }
  if (targetStatus === LeadStatus.CLOSED_LOST) {
    return `Lead #${leadNumber} (${fullName}) marcado como no concretado vía asistente.`;
  }
  if (targetStatus === LeadStatus.FOLLOW_UP) {
    const label = followUpReasonLabelEs[followUpReason] ?? followUpReason;
    return `Lead #${leadNumber} (${fullName}) enviado a seguimiento (${label}, ${days} días) vía asistente.`;
  }
  return `Actualización comercial en lead #${leadNumber} (${fullName}) vía asistente.`;
}

export function buildSmartStatusSuccessReply({
  fullName,
  targetStatus,
  followUpReason,
  days
}) {
  if (targetStatus === LeadStatus.CLOSED_SUCCESS) {
    return `${fullName} fue marcado como concretado.`;
  }
  if (targetStatus === LeadStatus.CLOSED_LOST) {
    return `${fullName} fue marcado como no concretado.`;
  }
  if (targetStatus === LeadStatus.FOLLOW_UP) {
    const label = followUpReasonLabelEs[followUpReason] ?? followUpReason;
    return `${fullName} quedó en seguimiento (${label}) con próxima acción en ${days} días.`;
  }
  return `Actualicé la situación comercial de ${fullName}.`;
}

/** Corta el mensaje antes del verbo o frase comercial para extraer el nombre del lead. */
const LEAD_NAME_STOP_VERBS =
  /\s+(quiere|quiere que|está|esta|est[aá]|ya|no|me pidió|me pidi[oó]|necesita|decidió|decidio|rechazó|rechazo|firmó|firmo|aceptó|acepto|compró|compro|canceló|cancelo|desea|pide|pidió|piensa|analiza|reprogramar|mover|lo está|lo esta|anda|andá|andaba|viaja|viajó|viaje|ocupad|trabajando)\b/i;

const LEAD_NAME_START_VERBS =
  /^(quiere|está|esta|est[aá]|ya|no|necesita|decidió|decidio|rechazó|rechazo|firmó|firmo|aceptó|acepto|compró|compro|canceló|cancelo|desea|pide|pidió|piensa|analiza|reprogramar|mover|anda|andá|viaja|viajó)\b/i;

/** Indica que el texto completo describe situación comercial, no solo un nombre. */
const LEAD_NAME_COMMERCIAL_MARKERS =
  /\b(quiere|piensa|necesita|firmó|firmo|aceptó|compró|no tiene|sin dinero|de viaje|anda|viaja|viajó|ocupad|rechazó|no está interesado)\b/i;

function isTrustedInterpretationLeadName(name, userMessage) {
  const n = String(name ?? "").trim();
  const text = String(userMessage ?? "").trim();
  if (!n || n.length < 2) return false;
  if (!text.toLowerCase().includes(n.toLowerCase())) return false;
  if (LEAD_NAME_COMMERCIAL_MARKERS.test(n)) return false;
  if (n.toLowerCase() === text.toLowerCase() && LEAD_NAME_COMMERCIAL_MARKERS.test(text)) {
    return false;
  }
  return true;
}

/**
 * Extrae el nombre del lead del mensaje del usuario (prioridad sobre la IA).
 * Nunca devuelve el mensaje completo si contiene contexto comercial.
 * @param {string} message
 * @returns {string|null}
 */
export function extractLeadNameFromCommercialMessage(message) {
  const text = String(message ?? "").trim();
  if (!text || LEAD_NAME_START_VERBS.test(text)) return null;

  let candidate = text;
  const cut = LEAD_NAME_STOP_VERBS.exec(text);
  if (cut && cut.index > 0) {
    candidate = text.slice(0, cut.index).trim();
  } else if (cut) {
    return null;
  }

  candidate = candidate
    .replace(/^(a|al|la|el|cliente|lead|prospecto)\s+/i, "")
    .replace(/[.,;:!?]+$/, "")
    .trim();

  if (candidate.length < 2 || !/[a-záéíóúñ]/i.test(candidate)) {
    return null;
  }

  if (LEAD_NAME_START_VERBS.test(candidate)) {
    return null;
  }

  if (
    candidate.toLowerCase() === text.toLowerCase() &&
    LEAD_NAME_COMMERCIAL_MARKERS.test(text)
  ) {
    return null;
  }

  return candidate;
}

/**
 * Criterio único de búsqueda para SMART_STATUS_UPDATE.
 * Nunca usa el mensaje completo del usuario como query.
 * @param {{ userMessage?: string, interpretation?: object, leadName?: string|null }} params
 * @returns {string|null}
 */
export function resolveSmartStatusLeadSearchQuery({
  userMessage,
  interpretation = {},
  leadName = null
} = {}) {
  const text = String(userMessage ?? "").trim();
  const fromPayload =
    String(leadName ?? interpretation.leadName ?? "").trim() || null;
  const extracted = extractLeadNameFromCommercialMessage(text);

  if (fromPayload && isTrustedInterpretationLeadName(fromPayload, text)) {
    return fromPayload;
  }

  if (extracted) {
    return extracted;
  }

  return fromPayload;
}

/**
 * @param {string} userMessage
 * @param {{ leadName?: string|null }} interpretation
 */
export function resolveSmartStatusLeadName(userMessage, interpretation = {}) {
  return resolveSmartStatusLeadSearchQuery({ userMessage, interpretation });
}

/**
 * Resuelve el lead objetivo para SMART_STATUS_UPDATE.
 * @param {object} params
 */
export async function resolveSmartStatusLeadTarget({
  leadId,
  leadName,
  userMessage,
  interpretation,
  getLeadById,
  searchLeadsByNameQuery,
  rankLeadNameMatch
}) {
  if (leadId) {
    const lead = await getLeadById(String(leadId).trim());
    return { lead, ambiguous: false, candidates: [], resolvedQuery: lead.fullName };
  }

  const query = resolveSmartStatusLeadSearchQuery({
    userMessage,
    interpretation,
    leadName: leadName ?? interpretation?.leadName
  });

  if (!query || query.length < 2) {
    throw new Error("Indica el nombre del lead para actualizar su situación comercial.");
  }

  const candidates = await searchLeadsByNameQuery({ query });

  if (candidates.length === 0) {
    throw new Error(`No encontré ningún lead llamado ${query}.`);
  }

  if (candidates.length === 1) {
    const lead = await getLeadById(candidates[0].id);
    return { lead, ambiguous: false, candidates: [], resolvedQuery: query };
  }

  const bestRank = rankLeadNameMatch(candidates[0].fullName, query);
  const secondRank = rankLeadNameMatch(candidates[1].fullName, query);
  if (bestRank < secondRank) {
    const lead = await getLeadById(candidates[0].id);
    return { lead, ambiguous: false, candidates: [], resolvedQuery: query };
  }

  return {
    lead: null,
    ambiguous: true,
    candidates: candidates.slice(0, 10),
    resolvedQuery: query
  };
}

export function buildSmartStatusDisambiguationReply(leadName) {
  const name = String(leadName ?? "este nombre").trim() || "este nombre";
  return `Encontré varios leads llamados ${name}. ¿Cuál deseas actualizar?`;
}
