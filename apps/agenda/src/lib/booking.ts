import { and, eq } from "drizzle-orm";
import { normalizePhone } from "@stackline/core/format";
import { localToUtc } from "@stackline/core/time";
import type { Db } from "@/db";
import { appointments, customers, professionals, services } from "@/db/schema";
import { newToken } from "@/db/seed";
import { getAvailableSlots, lockProfessional } from "./slots";

export class BookingError extends Error {}

/**
 * Crea una cita verificando de nuevo la disponibilidad dentro de una
 * transacción con bloqueo por profesional, así dos personas no pueden tomar la
 * misma hora al mismo tiempo.
 */
export async function createBooking(
  db: Db,
  input: {
    orgId: string;
    tz: string;
    serviceId: string;
    professionalId: string | null;
    date: string;
    time: string;
    customer: { name: string; phone: string; email?: string | null };
    source: "online" | "panel";
    notes?: string | null;
    chargeDeposit: boolean;
  },
) {
  const [service] = await db
    .select()
    .from(services)
    .where(and(eq(services.id, input.serviceId), eq(services.orgId, input.orgId), eq(services.active, true)));
  if (!service) throw new BookingError("El servicio no existe.");

  const slots = await getAvailableSlots(db, {
    orgId: input.orgId,
    tz: input.tz,
    serviceId: service.id,
    date: input.date,
    professionalId: input.professionalId,
  });
  const slot = slots.find((s) => s.time === input.time);
  if (!slot) throw new BookingError("Esa hora ya no está disponible. Elige otra, por favor.");
  const professionalId = input.professionalId ?? slot.professionalIds[0];

  const startsAt = localToUtc(input.date, input.time, input.tz);
  const endsAt = new Date(startsAt.getTime() + service.durationMin * 60_000);
  const deposit = input.chargeDeposit ? service.deposit : 0;
  const phone = normalizePhone(input.customer.phone);

  return db.transaction(async (tx) => {
    await lockProfessional(tx, professionalId);
    // Revalidar con el bloqueo tomado.
    const again = await getAvailableSlots(tx as unknown as Db, {
      orgId: input.orgId,
      tz: input.tz,
      serviceId: service.id,
      date: input.date,
      professionalId,
    });
    if (!again.some((s) => s.time === input.time)) {
      throw new BookingError("Esa hora se acaba de tomar. Elige otra, por favor.");
    }

    const [pro] = await tx
      .select({ id: professionals.id })
      .from(professionals)
      .where(and(eq(professionals.id, professionalId), eq(professionals.orgId, input.orgId)));
    if (!pro) throw new BookingError("El profesional no existe.");

    const [customer] = await tx
      .insert(customers)
      .values({ orgId: input.orgId, name: input.customer.name.trim(), phone, email: input.customer.email || null })
      .onConflictDoUpdate({
        target: [customers.orgId, customers.phone],
        set: { name: input.customer.name.trim(), ...(input.customer.email ? { email: input.customer.email } : {}) },
      })
      .returning();

    const [appt] = await tx
      .insert(appointments)
      .values({
        orgId: input.orgId,
        professionalId,
        serviceId: service.id,
        customerId: customer.id,
        startsAt,
        endsAt,
        status: deposit > 0 ? "pending_payment" : "confirmed",
        price: service.price,
        depositAmount: deposit,
        depositStatus: deposit > 0 ? "pending" : "none",
        manageToken: newToken(),
        source: input.source,
        notes: input.notes ?? null,
      })
      .returning();
    return appt;
  });
}
