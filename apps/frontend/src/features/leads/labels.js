/** Etiquetas en español para UI (evitar mostrar enums crudos). */

export const leadStatusLabel = {
  NEW: "Nuevo",
  CONTACTED: "Contactado",
  SCHEDULED: "Reunión agendada",
  FOLLOW_UP: "Seguimiento",
  CLOSED_INVESTED: "Cerró · Invirtió",
  CLOSED_NOT_INVESTED: "Cerró · No invirtió"
};

export const leadSourceLabel = {
  REFERIDO: "Referido",
  DIRECTO: "Directo",
  PAGINA_WEB: "Página web",
  REDES_SOCIALES: "Redes sociales",
  OTRO: "Otro"
};

/** Valores legacy antes de migración (por si el cliente aún envía datos antiguos). */
export const legacyLeadSourceLabel = {
  ...leadSourceLabel,
  REFERRAL: "Referido",
  DIRECT: "Directo",
  ORGANIC: "Página web",
  OTHER: "Otro"
};

export function displayLeadSource(source) {
  return leadSourceLabel[source] ?? legacyLeadSourceLabel[source] ?? source;
}

export const followUpReasonLabel = {
  NO_RESPONSE: "No responde",
  NO_MONEY: "No tiene liquidez",
  CALL_LATER: "Llamar después",
  THINKING: "Lo está pensando",
  BUSY: "Ocupado",
  OTHER: "Otro"
};

export const followUpReasonOptions = [
  { value: "NO_RESPONSE", label: "No responde" },
  { value: "NO_MONEY", label: "No tiene liquidez" },
  { value: "CALL_LATER", label: "Llamar después" },
  { value: "THINKING", label: "Lo está pensando" },
  { value: "BUSY", label: "Ocupado" },
  { value: "OTHER", label: "Otro" }
];

export const activityTypeLabel = {
  LEAD_CREATED: "Lead creado",
  LEAD_UPDATED: "Ficha actualizada",
  STATUS_CHANGED: "Estado del lead",
  NOTE_ADDED: "Nota",
  WHATSAPP_SENT: "WhatsApp enviado",
  WHATSAPP_RECEIVED: "WhatsApp recibido",
  REMINDER_CREATED: "Recordatorio",
  MEETING_SCHEDULED: "Reunión agendada",
  LEAD_REACTIVATED: "Lead reactivado",
  LEAD_CLOSED: "Cierre"
};
