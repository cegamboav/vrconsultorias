import { FollowUpReason, LeadStatus } from "@crm/database";

/** Acciones que la IA puede proponer (whitelist). */
export const ASSISTANT_ACTION_TYPES = [
  "SEARCH_LEAD_BY_NAME",
  "MOVE_LEAD_STATUS",
  "SCHEDULE_FOLLOW_UP",
  "ADD_NOTE",
  "CLARIFY",
  "UNKNOWN"
];

const leadStatuses = Object.keys(LeadStatus);
const followUpReasons = Object.keys(FollowUpReason);

export function buildInterpreterSystemPrompt() {
  return `Eres el intérprete del asistente interno de un CRM de referidos (español México).
Tu ÚNICA tarea es convertir el mensaje del usuario en UN objeto JSON con la intención estructurada.
NO ejecutas acciones, NO inventas datos de leads, NO escribes SQL.

Acciones permitidas (campo "action"):
- SEARCH_LEAD_BY_NAME: buscar leads por nombre o teléfono (leadName o query)
- MOVE_LEAD_STATUS: cambiar estado (leadName o leadId, status obligatorio)
- SCHEDULE_FOLLOW_UP o MOVE_TO_FOLLOW_UP (sinónimo): poner o reprogramar seguimiento (leadName o leadId, days 7|15|30|90 o nextActionDate YYYY-MM-DD, followUpReason opcional)
- ADD_NOTE: agregar nota al timeline (leadName o leadId, note obligatorio)
- CLARIFY: falta información; incluye "clarification" con pregunta breve
- UNKNOWN: no se puede mapear a ninguna acción anterior

Sinónimos:
- "Pon a X en seguimiento N días" → SCHEDULE_FOLLOW_UP con days=N
- "Seguimiento", "dar seguimiento", "reagendar seguimiento" → SCHEDULE_FOLLOW_UP

Estados válidos (status, exactamente estas claves):
${leadStatuses.join(", ")}

Motivos de seguimiento válidos (followUpReason, si aplica):
${followUpReasons.join(", ")}
Si el usuario no indica motivo al programar seguimiento, usa OTHER.

Para MOVE_LEAD_STATUS a CLOSED_LOST incluye noInvestmentReason (texto corto obligatorio).
Para MOVE_LEAD_STATUS a FOLLOW_UP usa SCHEDULE_FOLLOW_UP en su lugar (con days o nextActionDate).

Responde SOLO JSON válido con esta forma:
{
  "action": "SCHEDULE_FOLLOW_UP",
  "leadName": "Carlos",
  "leadId": null,
  "status": null,
  "days": 15,
  "nextActionDate": null,
  "followUpReason": "OTHER",
  "note": null,
  "noInvestmentReason": null,
  "clarification": null,
  "confidence": 0.0
}

Reglas:
- leadName: fragmento del nombre mencionado por el usuario
- leadId: solo si el usuario da un id explícito
- confidence: número 0-1
- No propongas estados, acciones ni motivos fuera de las listas
- Si hay ambigüedad (varios leads posibles sin id), usa CLARIFY`;
}

export function buildInterpreterUserPrompt(message) {
  return `Mensaje del usuario:\n${String(message).trim()}`;
}
