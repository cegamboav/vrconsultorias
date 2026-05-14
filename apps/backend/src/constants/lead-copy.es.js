/** Textos en español para descripciones de actividad (MVP). */

export const statusLabelEs = {
  NEW: "Nuevo",
  CONTACTED: "Contactado",
  SCHEDULED: "Reunión agendada",
  FOLLOW_UP: "Seguimiento",
  CLOSED_INVESTED: "Cerró · Invirtió",
  CLOSED_NOT_INVESTED: "Cerró · No invirtió"
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
  "SCHEDULED->CLOSED_INVESTED": "Cierre registrado: invirtió.",
  "SCHEDULED->CLOSED_NOT_INVESTED": "Cierre registrado: no invirtió.",
  "FOLLOW_UP->CONTACTED": "Lead reactivado desde seguimiento: de vuelta en contacto.",
  "FOLLOW_UP->SCHEDULED": "Lead reactivado desde seguimiento: reunión agendada.",
  "CLOSED_NOT_INVESTED->FOLLOW_UP": "Lead reactivado con seguimiento futuro.",
  "CLOSED_NOT_INVESTED->CONTACTED": "Lead reactivado desde cierre sin inversión.",
  "CLOSED_NOT_INVESTED->SCHEDULED": "Lead reactivado con reunión agendada."
};

export function formatStatusChangeDescription(from, to) {
  const key = `${from}->${to}`;
  if (Object.prototype.hasOwnProperty.call(transitionMessage, key)) {
    return transitionMessage[key];
  }
  const label = statusLabelEs[to] ?? to;
  return `Estado del lead actualizado a «${label}».`;
}
