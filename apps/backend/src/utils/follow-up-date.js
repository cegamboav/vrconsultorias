import { AppError } from "./app-error.js";

export function startOfLocalDay(date) {
  const d = new Date(date);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

export function addDaysLocal(date, days) {
  const d = startOfLocalDay(date);
  d.setDate(d.getDate() + days);
  return startOfLocalDay(d);
}

/** Inicio del día local tras sumar días al día de hoy. */
export function followUpDateAfterCalendarDays(days) {
  return addDaysLocal(new Date(), days);
}

/** YYYY-MM-DD en calendario local. */
export function toYmdLocal(date) {
  const x = startOfLocalDay(date);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const d = String(x.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Acepta YYYY-MM-DD o ISO; devuelve inicio del día local.
 */
export function parseDateInputToStartOfDay(input) {
  if (input === undefined || input === null || input === "") return null;
  const s = String(input).trim();
  const ymd = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (ymd) {
    const y = Number(ymd[1]);
    const m = Number(ymd[2]);
    const d = Number(ymd[3]);
    return new Date(y, m - 1, d, 0, 0, 0, 0);
  }
  const parsed = new Date(s);
  if (Number.isNaN(parsed.getTime())) return null;
  return startOfLocalDay(parsed);
}

export function calendarDaysFromTodayStart(targetStart) {
  const today = startOfLocalDay(new Date());
  const msPerDay = 86400000;
  const t0 = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const t1 = Date.UTC(
    targetStart.getFullYear(),
    targetStart.getMonth(),
    targetStart.getDate()
  );
  return Math.round((t1 - t0) / msPerDay);
}

export function assertMinSevenDaysFollowUp(dateStart) {
  const diff = calendarDaysFromTodayStart(dateStart);
  if (diff < 7) {
    throw new AppError(
      "La fecha de seguimiento debe ser al menos dentro de 7 días (solo fecha, sin hora obligatoria).",
      400
    );
  }
}

export function formatSpanishLongDate(date) {
  return date.toLocaleDateString("es-CR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

/** Fecha legible sin día de la semana (mensajes cortos en actividades). */
export function formatSpanishDayMonthYear(date) {
  return date.toLocaleDateString("es-CR", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}
