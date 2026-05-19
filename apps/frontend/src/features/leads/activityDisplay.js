/**
 * Textos legibles para la bitácora (evita jerga técnica y mensajes legacy).
 * @param {{ type: string, description?: string | null }} activity
 */
export function formatActivityDescription(activity) {
  const raw = activity.description ? String(activity.description).trim() : "";
  if (!raw) return "—";

  if (activity.type === "LEAD_UPDATED") {
    let t = raw;
    t = t.replace(/^Datos del lead actualizados:\s*/i, "Cambios en la ficha: ");
    t = t.replace(/Próxima acción \/ recordatorio actualizado/gi, "Fecha de próximo seguimiento ajustada");
    t = t.replace(/Nombre:\s*"[^"]*"\s*→\s*"[^"]*"/gi, "Nombre del contacto actualizado");
    t = t.replace(/^Se actualizó la ficha:\s*/i, "Se actualizó la ficha: ");
    return t;
  }

  if (activity.type === "LEAD_REACTIVATED" || activity.type === "STATUS_CHANGED") {
    if (/^Lead reabierto y enviado a /i.test(raw)) {
      return raw;
    }
    if (/^Se cambió el estado a /i.test(raw)) {
      return raw;
    }
    const m = /^Estado:\s*(.+?)\s*→\s*(.+)$/.exec(raw);
    if (m) {
      return `Flujo: de «${m[1].trim()}» a «${m[2].trim()}».`;
    }
  }

  return raw;
}
