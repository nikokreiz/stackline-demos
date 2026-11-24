import { getDb } from "@/db";
import { getBaseUrl } from "@/lib/base-url";
import { fetchMercadoPagoPayment, markDepositPaid, paymentsMode } from "@/lib/payments";

export const dynamic = "force-dynamic";

/**
 * Notificaciones de Mercado Pago. No se confía en el cuerpo: se toma el id del
 * pago y se consulta a la API de Mercado Pago antes de confirmar la cita.
 */
export async function POST(req: Request) {
  if (paymentsMode() !== "mercadopago") return new Response("ok");
  const url = new URL(req.url);
  let paymentId = url.searchParams.get("data.id") ?? url.searchParams.get("id");
  try {
    const body = (await req.json()) as { type?: string; data?: { id?: string | number } };
    if (body?.type === "payment" && body.data?.id) paymentId = String(body.data.id);
  } catch {
    // algunas notificaciones llegan sin cuerpo JSON
  }
  if (!paymentId) return new Response("ok");

  const pay = await fetchMercadoPagoPayment(paymentId);
  if (pay?.status === "approved" && pay.external_reference && /^[0-9a-f-]{36}$/i.test(pay.external_reference)) {
    await markDepositPaid(await getDb(), pay.external_reference, String(pay.id), await getBaseUrl());
  }
  return new Response("ok");
}
