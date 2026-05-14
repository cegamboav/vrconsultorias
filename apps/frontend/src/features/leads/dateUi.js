/** Fechas solo día (local) para inputs y reglas de seguimiento en UI. */

export function toLocalYmd(d) {
  if (!d) return "";
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function localYmdDaysFromToday(days) {
  const x = new Date();
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() + days);
  return toLocalYmd(x);
}

export function minFollowUpYmd() {
  return localYmdDaysFromToday(7);
}

export function formatDateOnly(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("es-CR", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function startOfLocalDayFromAny(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

/** Para FOLLOW_UP: vencido (día pasado), hoy o futuro. */
export function followUpDueBucket(nextActionDate) {
  if (!nextActionDate) return null;
  const target = startOfLocalDayFromAny(nextActionDate);
  const today = startOfLocalDayFromAny(new Date());
  if (!target || !today) return null;
  const t = target.getTime();
  const o = today.getTime();
  if (t < o) return "overdue";
  if (t === o) return "today";
  return "upcoming";
}
