/** Textos en español para descripciones de actividad (MVP). */

export const statusLabelEs = {
  NEW: "Nuevo",
  CONTACTED: "Contactado",
  SCHEDULED: "Reunión agendada",
  FOLLOW_UP: "Seguimiento",
  CLOSED_SUCCESS: "Concretado",
  CLOSED_LOST: "No concretado"
};

export const followUpReasonLabelEs = {
  NO_RESPONSE: "No responde",
  NO_MONEY: "No tiene liquidez",
  CALL_LATER: "Llamar después",
  THINKING: "Lo está pensando",
  BUSY: "Ocupado",
  OTHER: "Otro"
};

const transitionMessage = {
  "NEW->CONTACTED": "Primer contacto con el lead.",
  "CONTACTED->SCHEDULED": "Reunión agendada.",
  "CONTACTED->FOLLOW_UP": "Paso a seguimiento futuro (sin reunión previa).",
  "SCHEDULED->CLOSED_SUCCESS": "Cierre registrado: concretado.",
  "SCHEDULED->CLOSED_LOST": "Cierre registrado: no concretado.",
  "FOLLOW_UP->CONTACTED": "Lead reactivado desde seguimiento: de vuelta en contacto.",
  "FOLLOW_UP->SCHEDULED": "Lead reactivado desde seguimiento: reunión agendada.",
  "CLOSED_LOST->FOLLOW_UP": "Lead reactivado con seguimiento futuro.",
  "CLOSED_LOST->CONTACTED": "Lead reactivado desde cierre no concretado.",
  "CLOSED_LOST->SCHEDULED": "Lead reactivado con reunión agendada."
};

export function formatStatusChangeDescription(from, to) {
  const key = `${from}->${to}`;
  if (Object.prototype.hasOwnProperty.call(transitionMessage, key)) {
    return transitionMessage[key];
  }
  const label = statusLabelEs[to] ?? to;
  return `Estado del lead actualizado a «${label}».`;
}
