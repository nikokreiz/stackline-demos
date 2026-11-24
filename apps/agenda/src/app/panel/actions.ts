"use server";

import { randomBytes } from "node:crypto";
import { and, count, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { logAudit } from "@stackline/core/audit";
import { hashToken, switchSessionOrg } from "@stackline/core/auth";
import { hhmmToMinutes, isValidDateStr, localToUtc } from "@stackline/core/time";
import { resetDemo } from "@/db/seed";
import {
  appointments,
  blocks,
  customers,
  invitations,
  memberships,
  organizations,
  professionals,
  services,
  workingHours,
  type AppointmentStatus,
} from "@/db/schema";
import { getBaseUrl } from "@/lib/base-url";
import { BookingError, createBooking } from "@/lib/booking";
import { notifyAppointment } from "@/lib/notify";
import { canManage, panel } from "@/lib/panel";
import { sendDueReminders } from "@/lib/reminders";
import { getAvailableSlots } from "@/lib/slots";
import { isValidSlug, slugAvailable, slugify } from "@/lib/slug";
import { INDUSTRIES } from "@/lib/templates";
import { getOrg } from "@/lib/org";

async function manager() {
  const ctx = await panel();
  if (!canManage(ctx.session.role)) throw new Error("Solo el dueño o un administrador puede hacer este cambio.");
  return ctx;
}

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

// ---------- Citas ----------

const STATUS_CHANGES: AppointmentStatus[] = ["confirmed", "completed", "no_show", "cancelled"];

export async function setStatusAction(appointmentId: string, status: AppointmentStatus) {
  const { db, orgId, session } = await panel();
  if (!STATUS_CHANGES.includes(status)) throw new Error("Estado inválido");
  const [appt] = await db
    .select()
    .from(appointments)
    .where(and(eq(appointments.id, appointmentId), eq(appointments.orgId, orgId)));
  if (!appt) throw new Error("Cita no encontrada");
  await db
    .update(appointments)
    .set({
      status,
      cancelledAt: status === "cancelled" ? new Date() : null,
      // Si no llegó, el abono se retiene; si se cancela desde el local, se devuelve.
      depositStatus:
        status === "cancelled" && appt.depositStatus === "paid" ? "refunded" : appt.depositStatus,
    })
    .where(eq(appointments.id, appt.id));
  await logAudit(db, {
    orgId,
    userId: session.user.id,
    action: "cambia_estado",
    entity: "cita",
    entityId: appt.id,
    data: { de: appt.status, a: status },
  });
  if (status === "cancelled") await notifyAppointment(db, appt.id, "cancellation", await getBaseUrl());
  revalidatePath("/panel", "layout");
}

export async function panelSlotsAction(serviceId: string, professionalId: string | null, date: string) {
  const { db, orgId, tz } = await panel();
  if (!isValidDateStr(date)) return [];
  return getAvailableSlots(db, { orgId, tz, serviceId, professionalId, date });
}

const newApptSchema = z.object({
  serviceId: z.uuid(),
  professionalId: z.uuid().nullable(),
  date: z.string().refine(isValidDateStr),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  name: z.string().trim().min(2, "Falta el nombre del cliente."),
  phone: z.string().trim().min(8, "Falta un teléfono válido."),
  email: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  notify: z.boolean(),
});

export async function createAppointmentAction(input: z.input<typeof newApptSchema>): Promise<{ error?: string }> {
  const { db, orgId, tz, session } = await panel();
  const parsed = newApptSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const d = parsed.data;
  let id: string;
  try {
    const appt = await createBooking(db, {
      orgId,
      tz,
      serviceId: d.serviceId,
      professionalId: d.professionalId,
      date: d.date,
      time: d.time,
      customer: { name: d.name, phone: d.phone, email: d.email || null },
      source: "panel",
      notes: d.notes || null,
      chargeDeposit: false,
    });
    id = appt.id;
  } catch (e) {
    if (e instanceof BookingError) return { error: e.message };
    throw e;
  }
  await logAudit(db, { orgId, userId: session.user.id, action: "crea", entity: "cita", entityId: id });
  if (d.notify) await notifyAppointment(db, id, "confirmation", await getBaseUrl());
  redirect(`/panel/citas/${id}`);
}

// ---------- Clientes ----------

export async function saveCustomerNotesAction(customerId: string, form: FormData) {
  const { db, orgId, session } = await panel();
  await db
    .update(customers)
    .set({ notes: str(form, "notes") || null })
    .where(and(eq(customers.id, customerId), eq(customers.orgId, orgId)));
  await logAudit(db, { orgId, userId: session.user.id, action: "edita_notas", entity: "cliente", entityId: customerId });
  revalidatePath(`/panel/clientes/${customerId}`);
}

// ---------- Servicios ----------

const serviceSchema = z.object({
  name: z.string().trim().min(2),
  description: z.string().trim().optional(),
  durationMin: z.coerce.number().int().min(10).max(480),
  price: z.coerce.number().int().min(0),
  deposit: z.coerce.number().int().min(0),
});

export async function saveServiceAction(serviceId: string | null, form: FormData) {
  const { db, orgId, session } = await manager();
  const d = serviceSchema.parse(Object.fromEntries(form));
  const values = { ...d, description: d.description || null, deposit: Math.min(d.deposit, d.price) };
  if (serviceId) {
    await db.update(services).set(values).where(and(eq(services.id, serviceId), eq(services.orgId, orgId)));
  } else {
    await db.insert(services).values({ ...values, orgId, sort: 99 });
  }
  await logAudit(db, { orgId, userId: session.user.id, action: serviceId ? "edita" : "crea", entity: "servicio", entityId: serviceId, data: values });
  revalidatePath("/panel/servicios");
}

export async function toggleServiceAction(serviceId: string, active: boolean) {
  const { db, orgId, session } = await manager();
  await db.update(services).set({ active }).where(and(eq(services.id, serviceId), eq(services.orgId, orgId)));
  await logAudit(db, { orgId, userId: session.user.id, action: active ? "activa" : "desactiva", entity: "servicio", entityId: serviceId });
  revalidatePath("/panel/servicios");
}

// ---------- Equipo ----------

export async function addProfessionalAction(form: FormData) {
  const { db, orgId, session } = await manager();
  const name = str(form, "name");
  if (name.length < 2) return;
  const [p] = await db
    .insert(professionals)
    .values({ orgId, name, title: str(form, "title") || null, color: str(form, "color") || "#0f766e" })
    .returning();
  await logAudit(db, { orgId, userId: session.user.id, action: "crea", entity: "profesional", entityId: p.id });
  revalidatePath("/panel/equipo");
}

export async function toggleProfessionalAction(id: string, active: boolean) {
  const { db, orgId, session } = await manager();
  await db.update(professionals).set({ active }).where(and(eq(professionals.id, id), eq(professionals.orgId, orgId)));
  await logAudit(db, { orgId, userId: session.user.id, action: active ? "activa" : "desactiva", entity: "profesional", entityId: id });
  revalidatePath("/panel/equipo");
}

/** Cada día se escribe como "10:00-14:00, 15:00-20:00"; vacío = no trabaja. */
export async function saveHoursAction(professionalId: string, form: FormData): Promise<void> {
  const { db, orgId, session } = await manager();
  const [pro] = await db
    .select({ id: professionals.id })
    .from(professionals)
    .where(and(eq(professionals.id, professionalId), eq(professionals.orgId, orgId)));
  if (!pro) throw new Error("Profesional no encontrado");
  const rows: Array<typeof workingHours.$inferInsert> = [];
  for (let wd = 0; wd <= 6; wd++) {
    const raw = str(form, `d${wd}`);
    if (!raw) continue;
    for (const part of raw.split(",")) {
      const m = part.trim().match(/^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/);
      if (!m) throw new Error(`Formato inválido: "${part.trim()}". Usa 10:00-14:00.`);
      const startMin = hhmmToMinutes(m[1]);
      const endMin = hhmmToMinutes(m[2]);
      if (endMin <= startMin) throw new Error(`El tramo ${part.trim()} termina antes de empezar.`);
      rows.push({ orgId, professionalId, weekday: wd, startMin, endMin });
    }
  }
  await db.transaction(async (tx) => {
    await tx.delete(workingHours).where(eq(workingHours.professionalId, professionalId));
    if (rows.length) await tx.insert(workingHours).values(rows);
  });
  await logAudit(db, { orgId, userId: session.user.id, action: "edita_horario", entity: "profesional", entityId: professionalId });
  revalidatePath("/panel/equipo");
}

export async function addBlockAction(form: FormData) {
  const { db, orgId, tz, session } = await panel();
  const professionalId = str(form, "professionalId");
  const date = str(form, "date");
  const start = str(form, "start");
  const end = str(form, "end");
  if (!isValidDateStr(date) || !start || !end) return;
  const [pro] = await db
    .select({ id: professionals.id })
    .from(professionals)
    .where(and(eq(professionals.id, professionalId), eq(professionals.orgId, orgId)));
  if (!pro) return;
  const startsAt = localToUtc(date, start, tz);
  const endsAt = localToUtc(date, end, tz);
  if (endsAt <= startsAt) return;
  const [b] = await db
    .insert(blocks)
    .values({ orgId, professionalId, startsAt, endsAt, reason: str(form, "reason") || null })
    .returning();
  await logAudit(db, { orgId, userId: session.user.id, action: "crea", entity: "bloqueo", entityId: b.id });
  revalidatePath("/panel", "layout");
}

export async function deleteBlockAction(id: string) {
  const { db, orgId, session } = await panel();
  await db.delete(blocks).where(and(eq(blocks.id, id), eq(blocks.orgId, orgId)));
  await logAudit(db, { orgId, userId: session.user.id, action: "elimina", entity: "bloqueo", entityId: id });
  revalidatePath("/panel", "layout");
}

// ---------- Mensajes y demo ----------

export async function sendRemindersNowAction() {
  const { db, orgId, session } = await panel();
  const n = await sendDueReminders(db, await getBaseUrl(), orgId);
  await logAudit(db, { orgId, userId: session.user.id, action: "envia_recordatorios", entity: "mensajes", data: { cantidad: n } });
  revalidatePath("/panel/mensajes");
}

export async function resetDemoAction() {
  const { db, session } = await panel();
  if (session.role !== "owner") throw new Error("Solo el dueño puede reiniciar la demo.");
  await resetDemo(db);
  redirect("/login");
}

// ---------- Negocio (SaaS) ----------

export async function finishOnboardingAction() {
  const { db, orgId } = await manager();
  const org = await getOrg(db, orgId);
  await db
    .update(organizations)
    .set({ settings: { ...org.settings, onboardedAt: new Date().toISOString() } })
    .where(eq(organizations.id, orgId));
  revalidatePath("/panel");
}

export type SettingsState = { ok?: boolean; error?: string };

const HEX = /^#[0-9a-f]{6}$/i;

export async function saveSettingsAction(_prev: SettingsState, form: FormData): Promise<SettingsState> {
  const { db, orgId, session } = await manager();
  const org = await getOrg(db, orgId);
  const name = str(form, "name");
  const slug = slugify(str(form, "slug"));
  if (name.length < 3) return { error: "El nombre debe tener al menos 3 caracteres." };
  if (!isValidSlug(slug)) return { error: "El enlace solo puede tener letras, números y guiones (3 a 40 caracteres)." };
  if (slug !== org.slug && !(await slugAvailable(db, slug, orgId))) return { error: "Ese enlace ya lo usa otro negocio." };
  const brandColor = str(form, "brandColor");
  const industry = str(form, "industry");
  const cancellationHours = Math.min(72, Math.max(0, Number(str(form, "cancellationHours")) || 0));
  await db
    .update(organizations)
    .set({
      name,
      slug,
      industry: industry in INDUSTRIES ? industry : org.industry,
      settings: {
        ...org.settings,
        description: str(form, "description") || undefined,
        address: str(form, "address") || undefined,
        phone: str(form, "phone") || undefined,
        whatsapp: str(form, "whatsapp").replace(/[^\d+]/g, "") || undefined,
        instagram: str(form, "instagram") || undefined,
        brandColor: HEX.test(brandColor) ? brandColor : undefined,
        cancellationHours,
      },
    })
    .where(eq(organizations.id, orgId));
  await logAudit(db, { orgId, userId: session.user.id, action: "edita_ajustes", entity: "organizacion", entityId: orgId, data: { slug } });
  revalidatePath("/panel", "layout");
  return { ok: true };
}

export async function switchOrgAction(orgId: string) {
  const { db } = await panel();
  await switchSessionOrg(db, orgId);
  redirect("/panel");
}

// ---------- Usuarios del equipo ----------

const INVITE_DAYS = 7;

export type InviteState = { link?: string; error?: string };

export async function inviteAction(_prev: InviteState, form: FormData): Promise<InviteState> {
  const { db, orgId, session } = await manager();
  const email = str(form, "email").toLowerCase();
  const role = str(form, "role") === "admin" ? "admin" : "staff";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Escribe un correo válido." };
  const token = randomBytes(24).toString("base64url");
  await db.insert(invitations).values({
    orgId,
    email,
    role,
    tokenHash: hashToken(token),
    invitedBy: session.user.id,
    expiresAt: new Date(Date.now() + INVITE_DAYS * 24 * 3600_000),
  });
  await logAudit(db, { orgId, userId: session.user.id, action: "invita", entity: "usuario", data: { email, role } });
  revalidatePath("/panel/equipo");
  return { link: `${await getBaseUrl()}/invitacion/${token}` };
}

export async function revokeInvitationAction(id: string) {
  const { db, orgId, session } = await manager();
  await db.delete(invitations).where(and(eq(invitations.id, id), eq(invitations.orgId, orgId), isNull(invitations.acceptedAt)));
  await logAudit(db, { orgId, userId: session.user.id, action: "revoca_invitacion", entity: "usuario", entityId: id });
  revalidatePath("/panel/equipo");
}

export async function removeMemberAction(membershipId: string) {
  const { db, orgId, session } = await manager();
  const [m] = await db.select().from(memberships).where(and(eq(memberships.id, membershipId), eq(memberships.orgId, orgId)));
  if (!m) return;
  if (m.userId === session.user.id) throw new Error("No puedes quitarte a ti mismo.");
  if (m.role === "owner") {
    const [{ n }] = await db
      .select({ n: count() })
      .from(memberships)
      .where(and(eq(memberships.orgId, orgId), eq(memberships.role, "owner")));
    if (n <= 1) throw new Error("El negocio debe tener al menos un dueño.");
  }
  await db.delete(memberships).where(eq(memberships.id, m.id));
  // Cierra sus sesiones abiertas en este negocio.
  await db.execute(sql`delete from sessions where user_id = ${m.userId} and org_id = ${orgId}`);
  await logAudit(db, { orgId, userId: session.user.id, action: "quita_acceso", entity: "usuario", entityId: m.userId });
  revalidatePath("/panel/equipo");
}
