// Utilidades de rangos predefinidos para Reportes (Fase 2).
// Calculados en hora local del navegador y enviados al backend como ISO strings.

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function firstDayOfMonth(date) {
  const d = new Date(date);
  d.setDate(1);
  return startOfDay(d);
}

function lastDayOfMonth(date) {
  const d = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return endOfDay(d);
}

function firstDayOfPrevMonth(date) {
  const d = new Date(date);
  d.setMonth(d.getMonth() - 1, 1);
  return startOfDay(d);
}

function lastDayOfPrevMonth(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), 0);
  return endOfDay(d);
}

export const RANGE_KEYS = {
  TODAY: "today",
  LAST_7: "last_7",
  LAST_30: "last_30",
  CURRENT_MONTH: "current_month",
  PREV_MONTH: "prev_month",
  ALL: "all"
};

export const RANGE_OPTIONS = [
  { key: RANGE_KEYS.TODAY, label: "Hoy" },
  { key: RANGE_KEYS.LAST_7, label: "Últimos 7 días" },
  { key: RANGE_KEYS.LAST_30, label: "Últimos 30 días" },
  { key: RANGE_KEYS.CURRENT_MONTH, label: "Mes actual" },
  { key: RANGE_KEYS.PREV_MONTH, label: "Mes pasado" },
  { key: RANGE_KEYS.ALL, label: "Todo" }
];

export function computeRange(key, now = new Date()) {
  switch (key) {
    case RANGE_KEYS.TODAY:
      return { from: startOfDay(now), to: endOfDay(now) };
    case RANGE_KEYS.LAST_7:
      return { from: startOfDay(addDays(now, -6)), to: endOfDay(now) };
    case RANGE_KEYS.LAST_30:
      return { from: startOfDay(addDays(now, -29)), to: endOfDay(now) };
    case RANGE_KEYS.CURRENT_MONTH:
      return { from: firstDayOfMonth(now), to: endOfDay(now) };
    case RANGE_KEYS.PREV_MONTH:
      return { from: firstDayOfPrevMonth(now), to: lastDayOfPrevMonth(now) };
    case RANGE_KEYS.ALL:
    default:
      return { from: null, to: null };
  }
}

function formatDayMonthShort(date) {
  return date.toLocaleDateString("es-CR", { day: "2-digit", month: "short" });
}

export function describeRange(key, range) {
  const opt = RANGE_OPTIONS.find((o) => o.key === key);
  if (!opt) return "Todo el histórico";
  if (key === RANGE_KEYS.ALL) return "Todo el histórico";
  if (!range?.from || !range?.to) return opt.label;
  const a = formatDayMonthShort(range.from);
  const b = formatDayMonthShort(range.to);
  return a === b ? `${opt.label} · ${a}` : `${opt.label} · ${a} → ${b}`;
}
