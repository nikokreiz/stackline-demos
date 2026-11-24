import { and, eq, gt, gte, inArray, lt, ne, or, sql } from "drizzle-orm";
import { addDaysStr, localToUtc, minutesToHHMM, toLocalMinutes, weekdayOf } from "@stackline/core/time";
import type { Db } from "@/db";
import { appointments, blocks, professionals, services, workingHours } from "@/db/schema";

export const SLOT_STEP_MIN = 30;
/** No se puede reservar con menos de esta anticipación. */
export const MIN_LEAD_MIN = 60;
/** Una reserva esperando el abono retiene la hora durante este tiempo. */
export const HOLD_MIN = 20;
export const BOOKING_WINDOW_DAYS = 21;

export type Slot = { time: string; professionalIds: string[] };

type Range = { start: number; end: number };
const overlaps = (a: Range, b: Range) => a.start < b.end && b.start < a.end;

/**
 * Calcula las horas libres de un día para un servicio. Considera el horario de
 * cada profesional, sus citas activas, sus bloqueos y la anticipación mínima.
 * Si `ignoreAppointmentId` viene, esa cita no cuenta como ocupada (sirve para reagendar).
 */
export async function getAvailableSlots(
  db: Db,
  opts: {
    orgId: string;
    tz: string;
    serviceId: string;
    date: string;
    professionalId?: string | null;
    ignoreAppointmentId?: string;
  },
): Promise<Slot[]> {
  const [service] = await db
    .select()
    .from(services)
    .where(and(eq(services.id, opts.serviceId), eq(services.orgId, opts.orgId)));
  if (!service) return [];

  const pros = await db
    .select({ id: professionals.id })
    .from(professionals)
    .where(
      and(
        eq(professionals.orgId, opts.orgId),
        eq(professionals.active, true),
        opts.professionalId ? eq(professionals.id, opts.professionalId) : undefined,
      ),
    );
  if (pros.length === 0) return [];
  const proIds = pros.map((p) => p.id);

  const weekday = weekdayOf(opts.date);
  const dayStart = localToUtc(opts.date, "00:00", opts.tz);
  const dayEnd = localToUtc(addDaysStr(opts.date, 1), "00:00", opts.tz);
  const holdLimit = new Date(Date.now() - HOLD_MIN * 60_000);

  const [hours, appts, blks] = await Promise.all([
    db
      .select()
      .from(workingHours)
      .where(and(inArray(workingHours.professionalId, proIds), eq(workingHours.weekday, weekday))),
    db
      .select({
        professionalId: appointments.professionalId,
        startsAt: appointments.startsAt,
        endsAt: appointments.endsAt,
      })
      .from(appointments)
      .where(
        and(
          inArray(appointments.professionalId, proIds),
          lt(appointments.startsAt, dayEnd),
          gt(appointments.endsAt, dayStart),
          or(
            inArray(appointments.status, ["confirmed", "completed", "no_show"]),
            and(eq(appointments.status, "pending_payment"), gte(appointments.createdAt, holdLimit)),
          ),
          opts.ignoreAppointmentId ? ne(appointments.id, opts.ignoreAppointmentId) : undefined,
        ),
      ),
    db
      .select()
      .from(blocks)
      .where(and(inArray(blocks.professionalId, proIds), lt(blocks.startsAt, dayEnd), gt(blocks.endsAt, dayStart))),
  ]);

  const busyByPro = new Map<string, Range[]>();
  const toRange = (a: Date, b: Date): Range => ({
    start: a < dayStart ? 0 : toLocalMinutes(a, opts.tz),
    end: b >= dayEnd ? 24 * 60 : toLocalMinutes(b, opts.tz),
  });
  for (const a of appts) {
    const list = busyByPro.get(a.professionalId) ?? [];
    list.push(toRange(a.startsAt, a.endsAt));
    busyByPro.set(a.professionalId, list);
  }
  for (const b of blks) {
    const list = busyByPro.get(b.professionalId) ?? [];
    list.push(toRange(b.startsAt, b.endsAt));
    busyByPro.set(b.professionalId, list);
  }

  const earliest = Date.now() + MIN_LEAD_MIN * 60_000;
  const byTime = new Map<number, string[]>();
  for (const h of hours) {
    const busy = busyByPro.get(h.professionalId) ?? [];
    for (let t = h.startMin; t + service.durationMin <= h.endMin; t += SLOT_STEP_MIN) {
      const candidate = { start: t, end: t + service.durationMin };
      if (busy.some((b) => overlaps(b, candidate))) continue;
      if (localToUtc(opts.date, minutesToHHMM(t), opts.tz).getTime() < earliest) continue;
      const list = byTime.get(t) ?? [];
      list.push(h.professionalId);
      byTime.set(t, list);
    }
  }

  // Para "cualquier profesional", ofrecer primero a quien tiene menos carga ese día.
  const load = (id: string) => (busyByPro.get(id) ?? []).reduce((acc, r) => acc + (r.end - r.start), 0);
  return [...byTime.entries()]
    .sort(([a], [b]) => a - b)
    .map(([t, ids]) => ({ time: minutesToHHMM(t), professionalIds: ids.sort((a, b) => load(a) - load(b)) }));
}

/** Bloquea por transacción la agenda de un profesional para evitar dobles reservas simultáneas. */
export async function lockProfessional(tx: Pick<Db, "execute">, professionalId: string) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${professionalId}))`);
}
