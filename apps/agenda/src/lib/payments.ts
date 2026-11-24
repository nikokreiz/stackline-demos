import { and, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { appointments, organizations, services } from "@/db/schema";
import { notifyAppointment } from "./notify";

export const paymentsMode = () => (process.env.MERCADOPAGO_ACCESS_TOKEN ? "mercadopago" : "simulado");

/**
 * Devuelve la URL a la que hay que mandar al cliente para pagar el abono.
 * Sin credenciales de Mercado Pago, lleva a una pantalla de pago simulado.
 */
export async function createDepositCheckout(db: Db, appointmentId: string, baseUrl: string): Promise<string> {
  const [row] = await db
    .select({ appt: appointments, service: services, org: organizations })
    .from(appointments)
    .innerJoin(services, eq(services.id, appointments.serviceId))
    .innerJoin(organizations, eq(organizations.id, appointments.orgId))
    .where(eq(appointments.id, appointmentId));
  if (!row) throw new Error("Cita no encontrada");
  const { appt, service, org } = row;

  if (paymentsMode() === "simulado") return `/pago-simulado/${appt.manageToken}`;

  const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      items: [
        {
          title: `Abono ${service.name} · ${org.name}`,
          quantity: 1,
          unit_price: appt.depositAmount,
          currency_id: "CLP",
        },
      ],
      external_reference: appt.id,
      back_urls: {
        success: `${baseUrl}/cita/${appt.manageToken}?pago=ok`,
        pending: `${baseUrl}/cita/${appt.manageToken}?pago=pendiente`,
        failure: `${baseUrl}/cita/${appt.manageToken}?pago=error`,
      },
      auto_return: "approved",
      notification_url: `${baseUrl}/api/webhooks/mercadopago`,
      expires: true,
      expiration_date_to: new Date(Date.now() + 20 * 60_000).toISOString(),
    }),
  });
  if (!res.ok) throw new Error(`Mercado Pago ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const pref = (await res.json()) as { init_point: string };
  return pref.init_point;
}

/** Marca el abono como pagado y confirma la cita. Es idempotente. */
export async function markDepositPaid(db: Db, appointmentId: string, paymentRef: string, baseUrl: string) {
  const updated = await db
    .update(appointments)
    .set({ status: "confirmed", depositStatus: "paid", paymentRef })
    .where(and(eq(appointments.id, appointmentId), eq(appointments.status, "pending_payment")))
    .returning({ id: appointments.id });
  if (updated.length > 0) await notifyAppointment(db, appointmentId, "confirmation", baseUrl);
  return updated.length > 0;
}

/** Consulta un pago en Mercado Pago (lo usa el webhook, que nunca confía en el cuerpo recibido). */
export async function fetchMercadoPagoPayment(paymentId: string) {
  const res = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}` },
  });
  if (!res.ok) return null;
  return (await res.json()) as { id: number; status: string; external_reference: string | null };
}
