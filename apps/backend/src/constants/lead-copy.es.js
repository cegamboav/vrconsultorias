/** Textos en español para descripciones de actividad (MVP). */

/** Etiquetas cortas para cambios de estado en bitácora (neutras, reproducibles). */
export const statusChangeTimelineLabelEs = {
  NEW: "Nuevo",
  CONTACTED: "Contactado",
  SCHEDULED: "Agendado",
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

/**
 * Mensaje neutro por destino del estado (válido aunque el lead vuelva al mismo estado luego).
 */
export function formatStatusChangeDescription(_from, to) {
  const label = statusChangeTimelineLabelEs[to] ?? to;
  return `Se cambió el estado a ${label}.`;
}
