"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAudit } from "@stackline/core/audit";
import { addDaysStr, isValidDateStr, localToUtc, todayLocal } from "@stackline/core/time";
import { getDb, type Db } from "@/db";
import { appointments, organizations, services } from "@/db/schema";
import { getBaseUrl } from "@/lib/base-url";
import { notifyAppointment } from "@/lib/notify";
import { createDepositCheckout } from "@/lib/payments";
import { canChange } from "@/lib/policy";
import { BOOKING_WINDOW_DAYS, getAvailableSlots, lockProfessional } from "@/lib/slots";

async function load(token: string) {
  const db = await getDb();
  const [row] = await db
    .select({ appt: appointments, org: organizations, service: services })
    .from(appointments)
    .innerJoin(organizations, eq(organizations.id, appointments.orgId))
    .innerJoin(services, eq(services.id, appointments.serviceId))
    .where(eq(appointments.manageToken, token));
  if (!row) throw new Error("Cita no encontrada");
  return { db, ...row };
}

export async function confirmAttendanceAction(token: string) {
  const { db, appt } = await load(token);
  if (appt.status === "confirmed") {
    await db.update(appointments).set({ customerConfirmedAt: new Date() }).where(eq(appointments.id, appt.id));
    await logAudit(db, { orgId: appt.orgId, action: "cliente_confirma", entity: "cita", entityId: appt.id });
  }
  revalidatePath(`/cita/${token}`);
}

export async function cancelAction(token: string) {
  const { db, appt, org } = await load(token);
  if (!(canChange(appt, org.settings.cancellationHours ?? 4))) return;
  await db
    .update(appointments)
    .set({
      status: "cancelled",
      cancelledAt: new Date(),
      // Cancelación a tiempo: el abono se marca para devolución.
      depositStatus: appt.depositStatus === "paid" ? "refunded" : appt.depositStatus === "pending" ? "none" : appt.depositStatus,
    })
    .where(eq(appointments.id, appt.id));
  await logAudit(db, { orgId: appt.orgId, action: "cliente_cancela", entity: "cita", entityId: appt.id });
  await notifyAppointment(db, appt.id, "cancellation", await getBaseUrl());
  revalidatePath(`/cita/${token}`);
}

export async function payDepositAction(token: string) {
  const { db, appt } = await load(token);
  if (appt.status !== "pending_payment") redirect(`/cita/${token}`);
  redirect(await createDepositCheckout(db, appt.id, await getBaseUrl()));
}

export async function rescheduleSlotsAction(token: string, date: string) {
  const { db, appt, org } = await load(token);
  const today = todayLocal(org.timezone);
  if (!isValidDateStr(date) || date < today || date > addDaysStr(today, BOOKING_WINDOW_DAYS)) return [];
  return getAvailableSlots(db, {
    orgId: org.id,
    tz: org.timezone,
    serviceId: appt.serviceId,
    professionalId: appt.professionalId,
    date,
    ignoreAppointmentId: appt.id,
  });
}

export async function rescheduleAction(token: string, date: string, time: string): Promise<{ error?: string }> {
  const { db, appt, org, service } = await load(token);
  if (!(canChange(appt, org.settings.cancellationHours ?? 4))) {
    return { error: "Esta cita ya no se puede cambiar en línea. Escríbenos por WhatsApp." };
  }
  const ok = await db.transaction(async (tx) => {
    await lockProfessional(tx, appt.professionalId);
    const slots = await getAvailableSlots(tx as unknown as Db, {
      orgId: org.id,
      tz: org.timezone,
      serviceId: appt.serviceId,
      professionalId: appt.professionalId,
      date,
      ignoreAppointmentId: appt.id,
    });
    if (!slots.some((s) => s.time === time)) return false;
    const startsAt = localToUtc(date, time, org.timezone);
    await tx
      .update(appointments)
      .set({ startsAt, endsAt: new Date(startsAt.getTime() + service.durationMin * 60_000), reminderSentAt: null })
      .where(and(eq(appointments.id, appt.id)));
    return true;
  });
  if (!ok) return { error: "Esa hora ya no está disponible." };
  await logAudit(db, {
    orgId: org.id,
    action: "cliente_reagenda",
    entity: "cita",
    entityId: appt.id,
    data: { antes: appt.startsAt.toISOString(), fecha: date, hora: time },
  });
  if (appt.status === "confirmed") await notifyAppointment(db, appt.id, "confirmation", await getBaseUrl());
  revalidatePath(`/cita/${token}`);
  return {};
}
