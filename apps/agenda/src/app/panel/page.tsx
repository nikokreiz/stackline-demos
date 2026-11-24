import Link from "next/link";
import { and, eq, gte, inArray, lt } from "drizzle-orm";
import { Plus } from "lucide-react";
import { clp, fmtLongDay, fmtTime, pct } from "@stackline/core/format";
import { Badge, ButtonLink, Card, CardHeader, EmptyState, PageHeader, Stat } from "@stackline/core/ui";
import { addDaysStr, localToUtc, todayLocal } from "@stackline/core/time";
import { appointments } from "@/db/schema";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/labels";
import { panel } from "@/lib/panel";
import { appointmentsBetween } from "@/lib/queries";

export const metadata = { title: "Hoy" };

export default async function HoyPage() {
  const { db, orgId, tz, session } = await panel();
  const today = todayLocal(tz);
  const start = localToUtc(today, "00:00", tz);
  const tomorrow = localToUtc(addDaysStr(today, 1), "00:00", tz);
  const dayAfter = localToUtc(addDaysStr(today, 2), "00:00", tz);
  const monthAgo = localToUtc(addDaysStr(today, -30), "00:00", tz);

  const [todayAppts, tomorrowAppts, last30] = await Promise.all([
    appointmentsBetween(db, orgId, start, tomorrow),
    appointmentsBetween(db, orgId, tomorrow, dayAfter),
    db
      .select({ status: appointments.status, depositAmount: appointments.depositAmount })
      .from(appointments)
      .where(
        and(
          eq(appointments.orgId, orgId),
          gte(appointments.startsAt, monthAgo),
          lt(appointments.startsAt, start),
          inArray(appointments.status, ["completed", "no_show"]),
        ),
      ),
  ]);

  const active = todayAppts.filter((a) => a.status !== "cancelled");
  const revenue = active.filter((a) => a.status !== "no_show").reduce((s, a) => s + a.price, 0);
  const noShows = last30.filter((a) => a.status === "no_show");
  const kept = noShows.reduce((s, a) => s + a.depositAmount, 0);
  const now = new Date();
  const upcoming = active.filter((a) => a.endsAt > now);
  const unconfirmed = tomorrowAppts.filter((a) => a.status === "confirmed" && !a.customerConfirmedAt);
  const pendingPay = [...todayAppts, ...tomorrowAppts].filter((a) => a.status === "pending_payment");

  return (
    <>
      <PageHeader
        title={`Hola, ${session.user.name.split(" ")[0]}`}
        description={fmtLongDay(new Date(), tz)}
        actions={
          <ButtonLink href="/panel/citas/nueva">
            <Plus className="size-4" /> Nueva cita
          </ButtonLink>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Citas de hoy" value={active.length} hint={`${upcoming.length} por atender`} />
        <Stat label="Ventas estimadas hoy" value={clp(revenue)} hint="Citas no canceladas" />
        <Stat
          label="Inasistencias (30 días)"
          value={pct(last30.length ? noShows.length / last30.length : 0)}
          hint={`${noShows.length} de ${last30.length} citas`}
        />
        <Stat label="Abonos retenidos (30 días)" value={clp(kept)} hint="Por clientes que no llegaron" tone="up" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Próximas citas de hoy" action={<Link href="/panel/agenda" className="text-sm text-brand">Ver agenda</Link>} />
          {upcoming.length === 0 ? (
            <EmptyState title="No quedan citas por hoy" description="Las nuevas reservas online aparecerán aquí." />
          ) : (
            <ul className="divide-y divide-line">
              {upcoming.map((a) => (
                <li key={a.id}>
                  <Link href={`/panel/citas/${a.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-subtle">
                    <span className="w-12 font-semibold tabular-nums">{fmtTime(a.startsAt, tz)}</span>
                    <span className="h-8 w-1 rounded-full" style={{ background: a.proColor }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{a.customerName}</span>
                      <span className="block truncate text-sm text-ink-soft">
                        {a.serviceName} · {a.proName}
                      </span>
                    </span>
                    <Badge tone={STATUS_TONE[a.status]}>{STATUS_LABEL[a.status]}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Mañana sin confirmar" subtitle="Aún no confirman su asistencia" />
            {unconfirmed.length === 0 ? (
              <p className="px-5 py-4 text-sm text-ink-soft">Todo confirmado.</p>
            ) : (
              <ul className="divide-y divide-line">
                {unconfirmed.slice(0, 8).map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                    <Link href={`/panel/citas/${a.id}`} className="truncate hover:underline">
                      {fmtTime(a.startsAt, tz)} · {a.customerName}
                    </Link>
                    <a
                      href={`https://wa.me/${a.customerPhone.replace(/\D/g, "")}`}
                      className="shrink-0 text-xs text-brand"
                      target="_blank"
                      rel="noreferrer"
                    >
                      WhatsApp
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <CardHeader title="Esperando abono" />
            {pendingPay.length === 0 ? (
              <p className="px-5 py-4 text-sm text-ink-soft">Nada pendiente.</p>
            ) : (
              <ul className="divide-y divide-line">
                {pendingPay.map((a) => (
                  <li key={a.id} className="px-5 py-2.5 text-sm">
                    <Link href={`/panel/citas/${a.id}`} className="hover:underline">
                      {fmtTime(a.startsAt, tz)} · {a.customerName} · {clp(a.depositAmount)}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
