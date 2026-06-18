import { LeadStatus } from "@crm/database";
import {
  spanishStatusLabelToEnum,
  statusChangeTimelineLabelEs
} from "../constants/lead-copy.es.js";
import {
  parseDateInputToStartOfDay,
  startOfLocalDay,
  toYmdLocal
} from "../utils/follow-up-date.js";
import {
  PENDING_ACTIONS,
  getRefinementContextMessage,
  readAssistantContextMetadata
} from "./assistant-conversation-context.service.js";
import {
  buildAddLeadNoteChoiceReply,
  resolveLeadCandidateFromMessage
} from "./assistant-lead-note.service.js";
import {
  resolveSelectedMessageOption,
  resolveMessageRefinement,
  normalizeRefinementText
} from "./lead-contact-message.service.js";

const SPANISH_MONTHS = {
  enero: 0,
  febrero: 1,
  marzo: 2,
  abril: 3,
  mayo: 4,
  junio: 5,
  julio: 6,
  agosto: 7,
  septiembre: 8,
  setiembre: 8,
  octubre: 9,
  noviembre: 10,
  diciembre: 11
};

const STATUS_ONLY_PATTERN =
  /^(nuevo|contactado|agendado|seguimiento|concretado|no concretado)$/i;

/**
 * @param {string} text
 * @returns {string|null} LeadStatus key
 */
export function parseSpanishStatusLabel(text) {
  const normalized = String(text ?? "")
    .trim()
    .toLowerCase()
    .replace(/[.!?]+$/, "");

  if (!normalized) return null;

  if (spanishStatusLabelToEnum[normalized]) {
    return spanishStatusLabelToEnum[normalized];
  }

  for (const [label, status] of Object.entries(spanishStatusLabelToEnum)) {
    if (normalized === label) return status;
  }

  return null;
}

export function isStandaloneSpanishStatusMessage(text) {
  const normalized = String(text ?? "")
    .trim()
    .toLowerCase()
    .replace(/[.!?]+$/, "");
  return STATUS_ONLY_PATTERN.test(normalized);
}

/**
 * @param {string} text
 * @returns {string|null} YYYY-MM-DD
 */
export function parseSpanishDatePhrase(text) {
  const raw = String(text ?? "").trim();
  if (!raw) return null;

  const iso = parseDateInputToStartOfDay(raw);
  if (iso) {
    return toYmdLocal(iso);
  }

  const match =
    /(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)(?:\s+de\s+(\d{4}))?/i.exec(
      raw
    );
  if (!match) return null;

  const day = Number(match[1]);
  const month = SPANISH_MONTHS[match[2].toLowerCase()];
  if (month === undefined || day < 1 || day > 31) return null;

  let year = match[3] ? Number(match[3]) : new Date().getFullYear();
  let candidate = new Date(year, month, day, 0, 0, 0, 0);
  if (!match[3] && candidate < startOfLocalDay(new Date())) {
    year += 1;
    candidate = new Date(year, month, day, 0, 0, 0, 0);
  }

  return toYmdLocal(candidate);
}

/**
 * @param {import("./assistant-conversation-context.service.js").AssistantContextRecord} context
 * @param {string} message
 * @returns {object|null} interpretation
 */
export function buildInterpretationFromAssistantContext(context, message) {
  const text = String(message ?? "").trim();
  if (!text || !context?.pendingAction) return null;

  const base = {
    leadId: context.leadId ?? null,
    leadName: context.leadName ?? null
  };

  switch (context.pendingAction) {
    case PENDING_ACTIONS.MOVE_LEAD_STATUS: {
      const status = parseSpanishStatusLabel(text);
      if (!status) return null;

      if (status === LeadStatus.FOLLOW_UP) {
        return {
          action: "SCHEDULE_FOLLOW_UP",
          ...base,
          days: 7,
          followUpReason: "OTHER"
        };
      }

      const interpretation = {
        action: "MOVE_LEAD_STATUS",
        ...base,
        status
      };

      if (status === LeadStatus.CLOSED_LOST) {
        interpretation.noInvestmentReason =
          text.toLowerCase() === "no concretado"
            ? "Indicado vía asistente"
            : text;
      }

      return interpretation;
    }

    case PENDING_ACTIONS.SCHEDULE_FOLLOW_UP:
    case PENDING_ACTIONS.RESCHEDULE: {
      const nextActionDate = parseSpanishDatePhrase(text);
      if (!nextActionDate) return null;

      const targetStatus = context.metadata?.targetStatus ?? null;
      if (targetStatus === LeadStatus.SCHEDULED || context.pendingAction === PENDING_ACTIONS.RESCHEDULE) {
        return {
          action: "RESCHEDULE_APPOINTMENT",
          ...base,
          nextActionDate,
          targetStatus: LeadStatus.SCHEDULED
        };
      }

      return {
        action: "SCHEDULE_FOLLOW_UP",
        ...base,
        nextActionDate,
        followUpReason: context.metadata?.followUpReason ?? "OTHER"
      };
    }

    case PENDING_ACTIONS.ADD_NOTE:
    case PENDING_ACTIONS.ADD_LEAD_NOTE: {
      if (context.metadata?.pendingDisambiguation && context.metadata?.candidates) {
        const candidate = resolveLeadCandidateFromMessage(text, context.metadata.candidates);
        if (!candidate) return null;
        return {
          action: "ADD_LEAD_NOTE",
          leadId: candidate.id,
          leadName: candidate.fullName,
          note: null
        };
      }

      if (isStandaloneSpanishStatusMessage(text)) return null;
      if (text.length < 2) return null;
      return {
        action: "ADD_LEAD_NOTE",
        ...base,
        note: text
      };
    }

    case PENDING_ACTIONS.RESUME_LEAD: {
      if (context.metadata?.pendingDisambiguation && context.metadata?.candidates) {
        const candidate = resolveLeadCandidateFromMessage(text, context.metadata.candidates);
        if (!candidate) return null;
        return {
          action: "RESUME_LEAD",
          leadId: candidate.id,
          leadName: candidate.fullName
        };
      }
      return null;
    }

    case PENDING_ACTIONS.SUGGEST_NEXT_ACTION: {
      if (context.metadata?.pendingDisambiguation && context.metadata?.candidates) {
        const candidate = resolveLeadCandidateFromMessage(text, context.metadata.candidates);
        if (!candidate) return null;
        return {
          action: "SUGGEST_NEXT_ACTION",
          leadId: candidate.id,
          leadName: candidate.fullName
        };
      }
      return null;
    }

    case PENDING_ACTIONS.GENERATE_CONTACT_MESSAGE: {
      if (context.metadata?.pendingDisambiguation && context.metadata?.candidates) {
        const candidate = resolveLeadCandidateFromMessage(text, context.metadata.candidates);
        if (!candidate) return null;
        const prefs = context.metadata?.messagePreferences ?? {};
        return {
          action: "GENERATE_CONTACT_MESSAGE",
          leadId: candidate.id,
          leadName: candidate.fullName,
          style: prefs.style ?? null,
          isShort: prefs.isShort ?? false,
          isFormal: prefs.isFormal ?? false
        };
      }
      return null;
    }

    case PENDING_ACTIONS.GENERATE_MULTIPLE_CONTACT_MESSAGES: {
      if (context.metadata?.pendingDisambiguation && context.metadata?.candidates) {
        const candidate = resolveLeadCandidateFromMessage(text, context.metadata.candidates);
        if (!candidate) return null;
        return {
          action: "GENERATE_MULTIPLE_CONTACT_MESSAGES",
          leadId: candidate.id,
          leadName: candidate.fullName
        };
      }
      return null;
    }

    case PENDING_ACTIONS.MULTIPLE_MESSAGE_SELECTION: {
      const options = context.metadata?.options ?? [];
      const selected = resolveSelectedMessageOption(text, options);
      if (!selected) return null;

      return {
        action: "SELECT_GENERATED_MESSAGE_OPTION",
        leadId: context.leadId,
        leadName: context.leadName,
        selectedIndex: selected.index,
        selectedStyle: selected.style,
        message: selected.message
      };
    }

    case PENDING_ACTIONS.MESSAGE_REFINEMENT: {
      const metadata = readAssistantContextMetadata(context);
      const currentMessage = getRefinementContextMessage(context);
      if (!currentMessage) return null;

      // TODO: remove — instrumentación temporal REFINE
      console.log("[REFINE] raw =", text);
      const normalized = normalizeRefinementText(text);
      console.log("[REFINE] normalized =", normalized);
      const refinement = resolveMessageRefinement(text);
      console.log("[REFINE] refinement =", refinement);

      if (!refinement) {
        console.log("[REFINE] SHORTER_NOT_DETECTED", {
          text,
          normalized,
          refinement
        });
        return null;
      }

      return {
        action: "REFINE_SELECTED_MESSAGE",
        leadId: context.leadId,
        leadName: context.leadName,
        refinement,
        originalStyle: metadata.selectedStyle ?? null,
        message: currentMessage
      };
    }

    default:
      return null;
  }
}

export function buildAllowedTransitionsReply({ fullName, currentStatus, allowedStatuses }) {
  const currentLabel = statusChangeTimelineLabelEs[currentStatus] ?? currentStatus;
  const options = allowedStatuses
    .map((status) => statusChangeTimelineLabelEs[status] ?? status)
    .join(", ");

  if (!options) {
    return `${fullName} está en ${currentLabel} y no tiene transiciones disponibles desde el asistente.`;
  }

  return `${fullName} actualmente está en ${currentLabel}. Puede pasar a: ${options}.`;
}

export function buildMoveLeadStatusClarification(leadName) {
  const name = String(leadName ?? "este lead").trim() || "este lead";
  return `¿A qué estado deseas cambiar a ${name}?`;
}

export function buildScheduleClarification(leadName) {
  const name = String(leadName ?? "este lead").trim() || "este lead";
  return `¿Para qué fecha deseas reprogramar a ${name}?`;
}

export function buildAddNoteClarification(leadName) {
  const name = String(leadName ?? "este lead").trim() || "este lead";
  return `¿Qué nota deseas agregar a ${name}?`;
}

export const NO_PENDING_CONTEXT_REPLY =
  "No tengo una acción pendiente asociada a esa respuesta.";

/**
 * Infiere contexto persistente cuando el intérprete devuelve CLARIFY con leadName.
 * @param {{ clarification?: string|null, leadName?: string|null }} interpretation
 */
export function inferPersistContextFromClarify(interpretation) {
  const leadName = String(interpretation?.leadName ?? "").trim();
  if (!leadName) return null;

  const text = String(interpretation?.clarification ?? "").toLowerCase();

  if (/estado/.test(text)) {
    return {
      pendingAction: PENDING_ACTIONS.MOVE_LEAD_STATUS,
      leadName,
      leadId: interpretation.leadId ?? null,
      metadata: null
    };
  }

  if (/fecha|reprogram/.test(text)) {
    return {
      pendingAction: PENDING_ACTIONS.RESCHEDULE,
      leadName,
      leadId: interpretation.leadId ?? null,
      metadata: { targetStatus: LeadStatus.SCHEDULED }
    };
  }

  if (/nota/.test(text)) {
    return {
      pendingAction: PENDING_ACTIONS.ADD_LEAD_NOTE,
      leadName,
      leadId: interpretation.leadId ?? null,
      metadata: null
    };
  }

  return null;
}

const WRITE_ACTIONS_THAT_CLEAR_CONTEXT = new Set([
  "MOVE_LEAD_STATUS",
  "SCHEDULE_FOLLOW_UP",
  "ADD_NOTE",
  "ADD_LEAD_NOTE",
  "RESCHEDULE_APPOINTMENT",
  "SMART_STATUS_UPDATE",
  "RESUME_LEAD",
  "SUGGEST_NEXT_ACTION",
  "GENERATE_CONTACT_MESSAGE"
]);

export function shouldClearContextAfterAction(action) {
  return WRITE_ACTIONS_THAT_CLEAR_CONTEXT.has(String(action ?? "").toUpperCase());
}
