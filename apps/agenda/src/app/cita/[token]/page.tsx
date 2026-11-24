import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { CalendarClock, CheckCircle2, MapPin, MessageCircle } from "lucide-react";
import { clp, fmtLongDay, fmtTime } from "@stackline/core/format";
import { Badge, Button, ButtonLink, Card } from "@stackline/core/ui";
import { todayLocal } from "@stackline/core/time";
import { getDb } from "@/db";
import { appointments, customers, organizations, professionals, services } from "@/db/schema";
import { getBaseUrl } from "@/lib/base-url";
import { DEPOSIT_LABEL, STATUS_LABEL, STATUS_TONE } from "@/lib/labels";
import { fetchMercadoPagoPayment, markDepositPaid, paymentsMode } from "@/lib/payments";
import { canChange } from "@/lib/policy";
import { BOOKING_WINDOW_DAYS } from "@/lib/slots";
import { cancelAction, confirmAttendanceAction, payDepositAction } from "./actions";
import { Reschedule } from "./reschedule";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tu cita", robots: { index: false } };

export default async function CitaPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  const db = await getDb();

  const load = () =>
    db
      .select({ appt: appointments, org: organizations, service: services, pro: professionals, customer: customers })
      .from(appointments)
      .innerJoin(organizations, eq(organizations.id, appointments.orgId))
      .innerJoin(services, eq(services.id, appointments.serviceId))
      .innerJoin(professionals, eq(professionals.id, appointments.professionalId))
      .innerJoin(customers, eq(customers.id, appointments.customerId))
      .where(eq(appointments.manageToken, token))
      .then((r) => r[0]);

  let row = await load();
  if (!row) notFound();

  // Al volver desde Mercado Pago, verificar el pago directamente (por si el webhook aún no llega).
  if (sp.payment_id && row.appt.status === "pending_payment" && paymentsMode() === "mercadopago") {
    const pay = await fetchMercadoPagoPayment(sp.payment_id);
    if (pay?.status === "approved" && pay.external_reference === row.appt.id) {
      await markDepositPaid(db, row.appt.id, String(pay.id), await getBaseUrl());
      row = (await load())!;
    }
  }

  const { appt, org, service, pro, customer } = row;
  const tz = org.timezone;
  const changeable = canChange(appt, org.settings.cancellationHours ?? 4);
  const isNew = sp.nueva === "1" || sp.pago === "ok";

  return (
    <div className="min-h-dvh bg-canvas px-4 py-10">
      <div className="mx-auto max-w-md">
        {isNew && appt.status === "confirmed" && (
          <div className="mb-6 flex items-center gap-3 rounded-xl bg-emerald-50 p-4 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
            <CheckCircle2 className="size-6 shrink-0" />
            <div>
              <p className="font-medium">¡Listo, {customer.name.split(" ")[0]}! Tu hora quedó reservada.</p>
              <p className="text-sm">Te enviamos la confirmación por WhatsApp. Guarda este enlace para gestionar tu cita.</p>
            </div>
          </div>
        )}

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-ink-soft">{org.name}</p>
            <Badge tone={STATUS_TONE[appt.status]}>{STATUS_LABEL[appt.status]}</Badge>
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">{service.name}</h1>
          <p className="mt-2 flex items-center gap-2 text-ink">
            <CalendarClock className="size-4 text-brand" />
            {fmtLongDay(appt.startsAt, tz)} · {fmtTime(appt.startsAt, tz)} a {fmtTime(appt.endsAt, tz)}
          </p>
          <p className="mt-1 text-sm text-ink-soft">Con {pro.name}</p>
          {org.settings.address && (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-soft">
              <MapPin className="size-4" /> {org.settings.address}
            </p>
          )}

          <dl className="mt-5 space-y-1 border-t border-line pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-soft">Valor</dt>
              <dd className="tabular-nums">{clp(appt.price)}</dd>
            </div>
            {appt.depositAmount > 0 && (
              <div className="flex justify-between">
                <dt className="text-ink-soft">{DEPOSIT_LABEL[appt.depositStatus]}</dt>
                <dd className="tabular-nums">{clp(appt.depositAmount)}</dd>
              </div>
            )}
            {appt.depositStatus === "paid" && (
              <div className="flex justify-between font-medium">
                <dt>Por pagar en el local</dt>
                <dd className="tabular-nums">{clp(appt.price - appt.depositAmount)}</dd>
              </div>
            )}
          </dl>

          <div className="mt-6 space-y-2">
            {appt.status === "pending_payment" && (
              <form action={payDepositAction.bind(null, token)}>
                <Button className="w-full" size="lg">
                  Pagar abono de {clp(appt.depositAmount)}
                </Button>
                <p className="mt-2 text-center text-xs text-ink-soft">
                  Si no se paga en 20 minutos, la hora se libera.
                </p>
              </form>
            )}
            {appt.status === "confirmed" && !appt.customerConfirmedAt && appt.startsAt > new Date() && (
              <form action={confirmAttendanceAction.bind(null, token)}>
                <Button className="w-full">Confirmo que asistiré</Button>
              </form>
            )}
            {appt.status === "confirmed" && appt.customerConfirmedAt && (
              <p className="flex items-center justify-center gap-2 rounded-lg bg-brand-soft py-2 text-sm text-brand-strong">
                <CheckCircle2 className="size-4" /> Asistencia confirmada
              </p>
            )}
            {changeable && appt.status === "confirmed" && (
              <Reschedule token={token} today={todayLocal(tz)} days={BOOKING_WINDOW_DAYS} />
            )}
            {changeable && (
              <form action={cancelAction.bind(null, token)}>
                <Button variant="ghost" className="w-full text-red-600 hover:text-red-700">
                  Cancelar cita
                </Button>
              </form>
            )}
            {!changeable && (appt.status === "confirmed" || appt.status === "pending_payment") && (
              <p className="text-center text-xs text-ink-soft">
                Faltan menos de {org.settings.cancellationHours ?? 4} horas: para cambios, escríbenos.
              </p>
            )}
            {appt.status === "cancelled" && (
              <ButtonLink href={`/reservar/${org.slug}`} className="w-full">
                Reservar otra hora
              </ButtonLink>
            )}
          </div>
        </Card>

        {org.settings.whatsapp && (
          <a
            href={`https://wa.me/${org.settings.whatsapp.replace(/\D/g, "")}`}
            className="mt-4 flex items-center justify-center gap-2 text-sm text-ink-soft hover:text-ink"
          >
            <MessageCircle className="size-4" /> Escribir al local por WhatsApp
          </a>
        )}
      </div>
    </div>
  );
}
