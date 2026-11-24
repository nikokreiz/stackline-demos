import { and, asc, eq, gte, lt } from "drizzle-orm";
import type { Db } from "@/db";
import { appointments, customers, professionals, services } from "@/db/schema";

/** Citas de un rango con cliente, servicio y profesional. */
export function appointmentsBetween(db: Db, orgId: string, from: Date, to: Date) {
  return db
    .select({
      id: appointments.id,
      startsAt: appointments.startsAt,
      endsAt: appointments.endsAt,
      status: appointments.status,
      price: appointments.price,
      depositAmount: appointments.depositAmount,
      depositStatus: appointments.depositStatus,
      source: appointments.source,
      customerConfirmedAt: appointments.customerConfirmedAt,
      professionalId: appointments.professionalId,
      customerName: customers.name,
      customerId: customers.id,
      customerPhone: customers.phone,
      serviceName: services.name,
      serviceId: services.id,
      proName: professionals.name,
      proColor: professionals.color,
    })
    .from(appointments)
    .innerJoin(customers, eq(customers.id, appointments.customerId))
    .innerJoin(services, eq(services.id, appointments.serviceId))
    .innerJoin(professionals, eq(professionals.id, appointments.professionalId))
    .where(and(eq(appointments.orgId, orgId), gte(appointments.startsAt, from), lt(appointments.startsAt, to)))
    .orderBy(asc(appointments.startsAt));
}

export type ApptRow = Awaited<ReturnType<typeof appointmentsBetween>>[number];
