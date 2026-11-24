import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { clp, fmtDateTime, fmtLongDay, fmtTime } from "@stackline/core/format";
import { Badge, Button, Card, CardHeader, PageHeader } from "@stackline/core/ui";
import { toLocalDate } from "@stackline/core/time";
import { appointments, auditLog, customers, notifications, professionals, services, users } from "@/db/schema";
import { DEPOSIT_LABEL, STATUS_LABEL, STATUS_TONE } from "@/lib/labels";
import { panel } from "@/lib/panel";
import { setStatusAction } from "../../actions";

export const metadata = { title: "Cita" };

export default async function CitaDetalle({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, orgId, tz } = await panel();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [row] = await db
    .select({ appt: appointments, customer: customers, service: services, pro: professionals })
    .from(appointments)
    .innerJoin(customers, eq(customers.id, appointments.customerId))
    .innerJoin(services, eq(services.id, appointments.serviceId))
    .innerJoin(professionals, eq(professionals.id, appointments.professionalId))
    .where(and(eq(appointments.id, id), eq(appointments.orgId, orgId)));
  if (!row) notFound();
  const { appt, customer, service, pro } = row;

  const [msgs, history] = await Promise.all([
    db.select().from(notifications).where(eq(notifications.appointmentId, id)).orderBy(desc(notifications.createdAt)),
    db
      .select({ log: auditLog, userName: users.name })
      .from(auditLog)
      .leftJoin(users, eq(users.id, auditLog.userId))
      .where(and(eq(auditLog.orgId, orgId), eq(auditLog.entityId, id)))
      .orderBy(desc(auditLog.createdAt)),
  ]);

  const isPast = appt.startsAt < new Date();
  const actions: Array<{ status: "completed" | "no_show" | "cancelled" | "confirmed"; label: string; variant: "primary" | "secondary" | "danger" | "ghost" }> = [];
  if (appt.status === "confirmed" || appt.status === "pending_payment") {
    if (isPast || appt.status === "confirmed") actions.push({ status: "completed", label: "Marcar atendida", variant: "primary" });
    actions.push({ status: "no_show", label: "No asistió", variant: "secondary" });
    actions.push({ status: "cancelled", label: "Cancelar cita", variant: "ghost" });
  } else {
    actions.push({ status: "confirmed", label: "Volver a confirmada", variant: "ghost" });
  }

  return (
    <>
      <Link href={`/panel/agenda?fecha=${toLocalDate(appt.startsAt, tz)}`} className="mb-4 inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink">
        <ArrowLeft className="size-4" /> Agenda
      </Link>
      <PageHeader
        title={`${service.name} · ${customer.name}`}
        description={`${fmtLongDay(appt.startsAt, tz)}, ${fmtTime(appt.startsAt, tz)} a ${fmtTime(appt.endsAt, tz)} · ${pro.name}`}
        actions={<Badge tone={STATUS_TONE[appt.status]}>{STATUS_LABEL[appt.status]}</Badge>}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="p-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <Info label="Valor" value={clp(appt.price)} />
              <Info label={DEPOSIT_LABEL[appt.depositStatus]} value={appt.depositAmount ? clp(appt.depositAmount) : "—"} />
              <Info label="Origen" value={appt.source === "online" ? "Reserva online" : "Creada en el panel"} />
              <Info label="Confirmó asistencia" value={appt.customerConfirmedAt ? fmtDateTime(appt.customerConfirmedAt, tz) : "No"} />
              <Info label="Recordatorio" value={appt.reminderSentAt ? fmtDateTime(appt.reminderSentAt, tz) : "Pendiente"} />
              <Info label="Pago" value={appt.paymentRef ?? "—"} />
            </div>
            {appt.notes && <p className="mt-4 rounded-lg bg-subtle p-3 text-sm">{appt.notes}</p>}
            {actions.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-5">
                {actions.map((a) => (
                  <form key={a.status} action={setStatusAction.bind(null, appt.id, a.status)}>
                    <Button variant={a.variant}>{a.label}</Button>
                  </form>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Mensajes enviados" />
            {msgs.length === 0 ? (
              <p className="px-5 py-4 text-sm text-ink-soft">Sin mensajes para esta cita.</p>
            ) : (
              <ul className="divide-y divide-line">
                {msgs.map((m) => (
                  <li key={m.id} className="px-5 py-3 text-sm">
                    <div className="mb-1 flex items-center gap-2 text-xs text-ink-soft">
                      <Badge tone={m.status === "failed" ? "red" : m.status === "sent" ? "green" : "neutral"}>
                        {m.status === "simulated" ? "Simulado" : m.status === "sent" ? "Enviado" : "Falló"}
                      </Badge>
                      {fmtDateTime(m.createdAt, tz)}
                    </div>
                    <p>{m.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <p className="text-sm text-ink-soft">Cliente</p>
            <Link href={`/panel/clientes/${customer.id}`} className="mt-1 block font-semibold hover:underline">
              {customer.name}
            </Link>
            <p className="text-sm">{customer.phone}</p>
            {customer.email && <p className="text-sm text-ink-soft">{customer.email}</p>}
            <div className="mt-3 flex gap-3 text-sm">
              <a className="text-brand" href={`https://wa.me/${customer.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">
                WhatsApp
              </a>
              <a className="inline-flex items-center gap-1 text-brand" href={`/cita/${appt.manageToken}`} target="_blank">
                Vista del cliente <ExternalLink className="size-3.5" />
              </a>
            </div>
          </Card>
          <Card>
            <CardHeader title="Historial" />
            <ul className="space-y-3 px-5 py-4 text-sm">
              {history.map((h) => (
                <li key={h.log.id}>
                  <p>
                    {h.userName ?? "Cliente"} · {h.log.action.replace(/_/g, " ")}
                    {h.log.data && "a" in h.log.data ? ` → ${STATUS_LABEL[h.log.data.a as keyof typeof STATUS_LABEL] ?? h.log.data.a}` : ""}
                  </p>
                  <p className="text-xs text-ink-soft">{fmtDateTime(h.log.createdAt, tz)}</p>
                </li>
              ))}
              <li>
                <p>Cita creada ({appt.source === "online" ? "online" : "panel"})</p>
                <p className="text-xs text-ink-soft">{fmtDateTime(appt.createdAt, tz)}</p>
              </li>
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-ink-soft">{label}</p>
      <p className="mt-0.5 text-sm font-medium">{value}</p>
    </div>
  );
}
