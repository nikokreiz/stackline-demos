const clpFmt = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
const numFmt = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 });
const pctFmt = new Intl.NumberFormat("es-CL", { style: "percent", maximumFractionDigits: 1 });

export const clp = (n: number | string | null | undefined) => clpFmt.format(Math.round(Number(n ?? 0)));
export const num = (n: number | string | null | undefined) => numFmt.format(Number(n ?? 0));
export const pct = (ratio: number) => pctFmt.format(Number.isFinite(ratio) ? ratio : 0);

const TZ = "America/Santiago";

export function fmtDate(d: Date | string, tz = TZ, opts: Intl.DateTimeFormatOptions = { dateStyle: "medium" }) {
  return new Intl.DateTimeFormat("es-CL", { timeZone: tz, ...opts }).format(new Date(d));
}

export function fmtDateTime(d: Date | string, tz = TZ) {
  return new Intl.DateTimeFormat("es-CL", { timeZone: tz, dateStyle: "medium", timeStyle: "short" }).format(
    new Date(d),
  );
}

export function fmtTime(d: Date | string, tz = TZ) {
  return new Intl.DateTimeFormat("es-CL", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(
    new Date(d),
  );
}

export function fmtLongDay(d: Date | string, tz = TZ) {
  const s = new Intl.DateTimeFormat("es-CL", { timeZone: tz, weekday: "long", day: "numeric", month: "long" }).format(
    new Date(d),
  );
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Normaliza teléfonos chilenos a formato +569XXXXXXXX cuando es posible. */
export function normalizePhone(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 9 && digits.startsWith("9")) return `+56${digits}`;
  if (digits.length === 11 && digits.startsWith("569")) return `+${digits}`;
  if (digits.length === 8) return `+569${digits}`;
  return raw.trim().startsWith("+") ? `+${digits}` : digits;
}
