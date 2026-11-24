import { eq } from "drizzle-orm";
import { fmtLongDay, fmtTime } from "@stackline/core/format";
import type { Db } from "@/db";
import { appointments, customers, notifications, organizations, professionals, services } from "@/db/schema";

type Kind = "confirmation" | "reminder" | "cancellation";

export const whatsappMode = () =>
  process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID ? "whatsapp" : "simulado";

/**
 * Envía un mensaje por WhatsApp Cloud API. Fuera de la ventana de 24 horas
 * Meta exige plantillas aprobadas, por eso con WHATSAPP_TEMPLATE se envía la
 * plantilla con tres parámetros: nombre, fecha y hora, y enlace.
 */
async function sendWhatsApp(to: string, body: string, params: string[]) {
  const token = process.env.WHATSAPP_TOKEN!;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID!;
  const template = process.env.WHATSAPP_TEMPLATE;
  const payload = template
    ? {
        messaging_product: "whatsapp",
        to: to.replace(/\D/g, ""),
        type: "template",
        template: {
          name: template,
          language: { code: process.env.WHATSAPP_TEMPLATE_LANG ?? "es" },
          components: [{ type: "body", parameters: params.map((text) => ({ type: "text", text })) }],
        },
      }
    : { messaging_product: "whatsapp", to: to.replace(/\D/g, ""), type: "text", text: { body } };
  const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`WhatsApp ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

export async function notifyAppointment(db: Db, appointmentId: string, kind: Kind, baseUrl: string) {
  const [row] = await db
    .select({ appt: appointments, customer: customers, service: services, pro: professionals, org: organizations })
    .from(appointments)
    .innerJoin(customers, eq(customers.id, appointments.customerId))
    .innerJoin(services, eq(services.id, appointments.serviceId))
    .innerJoin(professionals, eq(professionals.id, appointments.professionalId))
    .innerJoin(organizations, eq(organizations.id, appointments.orgId))
    .where(eq(appointments.id, appointmentId));
  if (!row) return;

  const { appt, customer, service, pro, org } = row;
  const firstName = customer.name.split(" ")[0];
  const when = `${fmtLongDay(appt.startsAt, org.timezone)} a las ${fmtTime(appt.startsAt, org.timezone)}`;
  const link = `${baseUrl}/cita/${appt.manageToken}`;
  const body = {
    confirmation: `Hola ${firstName}, tu hora en ${org.name} quedó reservada: ${service.name} con ${pro.name}, ${when}. Puedes confirmar, cambiar o cancelar aquí: ${link}`,
    reminder: `Hola ${firstName}, te recordamos tu hora en ${org.name}: ${service.name} con ${pro.name}, ${when}. Confirma tu asistencia o cambia la hora aquí: ${link}`,
    cancellation: `Hola ${firstName}, tu hora en ${org.name} del ${when} fue cancelada. Si quieres, puedes reservar otra aquí: ${baseUrl}/reservar/${org.slug}`,
  }[kind];

  let status: "sent" | "simulated" | "failed" = "simulated";
  let error: string | null = null;
  if (whatsappMode() === "whatsapp") {
    try {
      await sendWhatsApp(customer.phone, body, [firstName, when, link]);
      status = "sent";
    } catch (e) {
      status = "failed";
      error = e instanceof Error ? e.message : String(e);
    }
  }

  await db.insert(notifications).values({
    orgId: org.id,
    appointmentId: appt.id,
    kind,
    channel: "whatsapp",
    to: customer.phone,
    body,
    status,
    error,
  });
  if (kind === "reminder" && status !== "failed") {
    await db.update(appointments).set({ reminderSentAt: new Date() }).where(eq(appointments.id, appt.id));
  }
}
