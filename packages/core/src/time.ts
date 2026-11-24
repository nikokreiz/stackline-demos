import { TZDate } from "@date-fns/tz";

/**
 * Utilidades de fecha en la zona horaria del negocio. Las fechas "locales" se
 * manejan como texto `YYYY-MM-DD` y horas como `HH:MM`, y se convierten a
 * instantes UTC solo al guardar o comparar.
 */

export const DEFAULT_TZ = "America/Santiago";

const pad = (n: number) => String(n).padStart(2, "0");

export function localToUtc(dateStr: string, timeStr: string, tz = DEFAULT_TZ): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  return new Date(new TZDate(y, m - 1, d, hh, mm, 0, tz).getTime());
}

export function toLocalDate(instant: Date | string, tz = DEFAULT_TZ): string {
  const t = new TZDate(new Date(instant).getTime(), tz);
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
}

export function toLocalTime(instant: Date | string, tz = DEFAULT_TZ): string {
  const t = new TZDate(new Date(instant).getTime(), tz);
  return `${pad(t.getHours())}:${pad(t.getMinutes())}`;
}

/** Minutos desde medianoche, hora local. */
export function toLocalMinutes(instant: Date | string, tz = DEFAULT_TZ): number {
  const t = new TZDate(new Date(instant).getTime(), tz);
  return t.getHours() * 60 + t.getMinutes();
}

export function todayLocal(tz = DEFAULT_TZ): string {
  return toLocalDate(new Date(), tz);
}

/** Suma días a una fecha `YYYY-MM-DD` (sin problemas de cambio de horario). */
export function addDaysStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** 0 = domingo … 6 = sábado. */
export function weekdayOf(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function minutesToHHMM(min: number): string {
  return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
}

export function hhmmToMinutes(s: string): number {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
}

export function isValidDateStr(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}
