"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { addDaysStr, isValidDateStr, todayLocal } from "@stackline/core/time";
import { getDb } from "@/db";
import { organizations } from "@/db/schema";
import { getBaseUrl } from "@/lib/base-url";
import { BookingError, createBooking } from "@/lib/booking";
import { notifyAppointment } from "@/lib/notify";
import { createDepositCheckout } from "@/lib/payments";
import { BOOKING_WINDOW_DAYS, getAvailableSlots } from "@/lib/slots";

async function orgBySlug(slug: string) {
  const db = await getDb();
  const [org] = await db.select().from(organizations).where(and(eq(organizations.slug, slug)));
  return { db, org };
}

function inWindow(date: string, tz: string) {
  const today = todayLocal(tz);
  return isValidDateStr(date) && date >= today && date <= addDaysStr(today, BOOKING_WINDOW_DAYS);
}

export async function getSlotsAction(slug: string, serviceId: string, professionalId: string | null, date: string) {
  const { db, org } = await orgBySlug(slug);
  if (!org || !inWindow(date, org.timezone)) return [];
  return getAvailableSlots(db, { orgId: org.id, tz: org.timezone, serviceId, professionalId, date });
}

const bookingSchema = z.object({
  slug: z.string(),
  serviceId: z.uuid(),
  professionalId: z.uuid().nullable(),
  date: z.string(),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  name: z.string().trim().min(2, "Escribe tu nombre.").max(80),
  phone: z
    .string()
    .trim()
    .refine((v) => v.replace(/\D/g, "").length >= 8, "Escribe un teléfono válido."),
  email: z.union([z.literal(""), z.email("El correo no es válido.")]).optional(),
});

export type BookResult = { ok: true; redirectTo: string } | { ok: false; error: string };

export async function bookAction(input: z.input<typeof bookingSchema>): Promise<BookResult> {
  const parsed = bookingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const data = parsed.data;
  const { db, org } = await orgBySlug(data.slug);
  if (!org) return { ok: false, error: "Negocio no encontrado." };
  if (!inWindow(data.date, org.timezone)) return { ok: false, error: "Fecha fuera de rango." };

  try {
    const appt = await createBooking(db, {
      orgId: org.id,
      tz: org.timezone,
      serviceId: data.serviceId,
      professionalId: data.professionalId,
      date: data.date,
      time: data.time,
      customer: { name: data.name, phone: data.phone, email: data.email || null },
      source: "online",
      chargeDeposit: true,
    });
    const baseUrl = await getBaseUrl();
    if (appt.status === "pending_payment") {
      return { ok: true, redirectTo: await createDepositCheckout(db, appt.id, baseUrl) };
    }
    await notifyAppointment(db, appt.id, "confirmation", baseUrl);
    return { ok: true, redirectTo: `/cita/${appt.manageToken}?nueva=1` };
  } catch (e) {
    if (e instanceof BookingError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: "No pudimos completar la reserva. Intenta de nuevo." };
  }
}
