/** Patrones para extraer lead + nota desde lenguaje natural. */
const LEAD_NOTE_WITH_CONTENT =
  /^(?:agrega(?:r)?(?:\s+una)?\s+nota\s+a(?:l)?|anota(?:r)?\s+en)\s+([^:\n]+?)\s*[:：]\s*(.+)$/is;

const LEAD_NOTE_NAME_ONLY =
  /^(?:agrega(?:r)?(?:\s+una)?\s+nota\s+a(?:l)?|anota(?:r)?\s+en)\s+(.+)$/i;

/**
 * @param {string} message
 * @returns {{ leadName: string, note: string|null }|null}
 */
export function extractLeadNoteFromMessage(message) {
  const text = String(message ?? "").trim();
  if (!text) return null;

  const withContent = LEAD_NOTE_WITH_CONTENT.exec(text);
  if (withContent) {
    const leadName = withContent[1].trim().replace(/[.!?]+$/, "");
    const note = withContent[2].trim();
    if (leadName.length >= 2 && note.length >= 2) {
      return { leadName, note };
    }
  }

  const nameOnly = LEAD_NOTE_NAME_ONLY.exec(text);
  if (nameOnly) {
    const leadName = nameOnly[1].trim().replace(/[.!?]+$/, "");
    if (leadName.length >= 2) {
      return { leadName, note: null };
    }
  }

  return null;
}

/**
 * Prioriza nombre/nota confiables del mensaje o de la interpretación.
 * @param {{ userMessage?: string, interpretation?: object }} params
 */
export function resolveLeadNotePayload({ userMessage, interpretation = {} }) {
  const extracted = extractLeadNoteFromMessage(userMessage);
  const fromAi = {
    leadName: String(interpretation.leadName ?? "").trim() || null,
    note: String(interpretation.note ?? "").trim() || null
  };

  if (extracted?.leadName && extracted.note) {
    return { leadName: extracted.leadName, note: extracted.note };
  }

  if (fromAi.leadName && fromAi.note) {
    return fromAi;
  }

  if (extracted?.leadName) {
    return {
      leadName: extracted.leadName,
      note: fromAi.note ?? extracted.note ?? null
    };
  }

  return fromAi;
}

export function buildAddLeadNoteSuccessReply(fullName) {
  const name = String(fullName ?? "el lead").trim() || "el lead";
  return `Nota agregada a ${name}.`;
}

export function buildAddLeadNoteDisambiguationReply(leadName) {
  const name = String(leadName ?? "este nombre").trim() || "este nombre";
  return `Encontré varios leads llamados ${name}. ¿A cuál deseas agregar la nota?`;
}

/**
 * Pregunta de elección entre candidatos concretos.
 * @param {Array<{ fullName: string }>} candidates
 */
export function buildAddLeadNoteChoiceReply(candidates) {
  const list = (candidates ?? []).map((c) => c.fullName).filter(Boolean);
  if (list.length === 0) {
    return "Encontré varios leads posibles. Indica el nombre completo.";
  }
  if (list.length === 1) {
    return `¿Te refieres a ${list[0]}?`;
  }
  if (list.length === 2) {
    return `¿${list[0]} o ${list[1]}?`;
  }
  const last = list.pop();
  return `¿${list.join(", ")} o ${last}?`;
}

/**
 * Resuelve un candidato cuando el usuario responde con nombre o número de lead.
 * @param {string} message
 * @param {Array<{ id: string, leadNumber: number, fullName: string }>} candidates
 */
export function resolveLeadCandidateFromMessage(message, candidates) {
  const text = String(message ?? "").trim();
  if (!text || !candidates?.length) return null;

  const lower = text.toLowerCase();

  const exact = candidates.find((c) => c.fullName.toLowerCase() === lower);
  if (exact) return exact;

  const numMatch = /^#?(\d+)$/.exec(text);
  if (numMatch) {
    const n = Number(numMatch[1]);
    const byNumber = candidates.find((c) => c.leadNumber === n);
    if (byNumber) return byNumber;
  }

  const partialMatches = candidates.filter((c) => {
    const name = c.fullName.toLowerCase();
    return name.includes(lower) || lower.includes(name);
  });

  if (partialMatches.length === 1) {
    return partialMatches[0];
  }

  if (partialMatches.length > 1) {
    const best = partialMatches.find((c) => c.fullName.toLowerCase() === lower);
    if (best) return best;
    const startsWith = partialMatches.filter((c) =>
      c.fullName.toLowerCase().startsWith(lower)
    );
    if (startsWith.length === 1) return startsWith[0];
  }

  return null;
}

export function buildAddLeadNoteClarification(leadName) {
  const name = String(leadName ?? "este lead").trim() || "este lead";
  return `¿Qué nota deseas agregar a ${name}?`;
}

export function buildLeadNotFoundReply(leadName) {
  const name = String(leadName ?? "ese nombre").trim() || "ese nombre";
  return `No encontré ningún lead llamado ${name}.`;
}
