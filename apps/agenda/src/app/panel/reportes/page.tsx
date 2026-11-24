import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { clp, pct } from "@stackline/core/format";
import { BarList, Card, CardHeader, PageHeader, Stat, Table, Td, Th, cn } from "@stackline/core/ui";
import { addDaysStr, localToUtc, todayLocal, weekdayOf } from "@stackline/core/time";
import { professionals, workingHours } from "@/db/schema";
import { panel } from "@/lib/panel";
import { appointmentsBetween } from "@/lib/queries";

export const metadata = { title: "Reportes" };

const PERIODS = [7, 30, 90];

export default async function ReportesPage({ searchParams }: { searchParams: Promise<{ dias?: string }> }) {
  const { db, orgId, tz, session } = await panel();
  if (session.role === "staff") redirect("/panel");
  const days = PERIODS.includes(Number((await searchParams).dias)) ? Number((await searchParams).dias) : 30;
  const today = todayLocal(tz);
  const fromStr = addDaysStr(today, -days);
  const from = localToUtc(fromStr, "00:00", tz);
  const to = new Date();

  const [appts, pros, hours] = await Promise.all([
    appointmentsBetween(db, orgId, from, to),
    db.select().from(professionals).where(eq(professionals.orgId, orgId)).orderBy(asc(professionals.name)),
    db.select().from(workingHours).where(eq(workingHours.orgId, orgId)),
  ]);

  const done = appts.filter((a) => a.status === "completed");
  const noShow = appts.filter((a) => a.status === "no_show");
  const cancelled = appts.filter((a) => a.status === "cancelled");
  const closed = done.length + noShow.length;
  const revenue = done.reduce((s, a) => s + a.price, 0);
  const keptDeposits = noShow.reduce((s, a) => s + (a.depositStatus === "paid" ? a.depositAmount : 0), 0);
  const online = appts.filter((a) => a.source === "online" && a.status !== "cancelled").length;
  const nonCancelled = appts.length - cancelled.length;

  // Minutos disponibles por profesional en el período, según su horario semanal.
  const availableByPro = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    const wd = weekdayOf(addDaysStr(fromStr, i));
    for (const h of hours.filter((x) => x.weekday === wd)) {
      availableByPro.set(h.professionalId, (availableByPro.get(h.professionalId) ?? 0) + (h.endMin - h.startMin));
    }
  }

  const byPro = pros.map((p) => {
    const mine = appts.filter((a) => a.professionalId === p.id);
    const d = mine.filter((a) => a.status === "completed");
    const ns = mine.filter((a) => a.status === "no_show");
    const booked = mine
      .filter((a) => a.status !== "cancelled")
      .reduce((s, a) => s + (a.endsAt.getTime() - a.startsAt.getTime()) / 60_000, 0);
    const available = availableByPro.get(p.id) ?? 0;
    return {
      p,
      revenue: d.reduce((s, a) => s + a.price, 0),
      visits: d.length,
      noShowRate: d.length + ns.length ? ns.length / (d.length + ns.length) : 0,
      occupancy: available ? booked / available : 0,
      ticket: d.length ? d.reduce((s, a) => s + a.price, 0) / d.length : 0,
    };
  });

  const byService = Object.values(
    done.reduce<Record<string, { label: string; value: number; n: number }>>((acc, a) => {
      acc[a.serviceId] ??= { label: a.serviceName, value: 0, n: 0 };
      acc[a.serviceId].value += a.price;
      acc[a.serviceId].n += 1;
      return acc;
    }, {}),
  )
    .sort((a, b) => b.value - a.value)
    .map((s) => ({ label: s.label, value: s.value, hint: `${s.n} citas` }));

  // Ocupación por día de la semana (citas no canceladas).
  const DAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const byWeekday = [1, 2, 3, 4, 5, 6, 0].map((wd) => ({
    label: DAYS[wd],
    value: appts.filter((a) => a.status !== "cancelled" && weekdayOf(todayLocalOf(a.startsAt, tz)) === wd).length,
  }));

  return (
    <>
      <PageHeader
        title="Reportes"
        description={`Últimos ${days} días, hasta hoy`}
        actions={
          <div className="flex rounded-lg border border-line bg-surface p-0.5">
            {PERIODS.map((p) => (
              <Link
                key={p}
                href={`?dias=${p}`}
                className={cn("rounded-md px-3 py-1.5 text-sm", p === days ? "bg-brand text-white" : "text-ink-soft hover:text-ink")}
              >
                {p} días
              </Link>
            ))}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Ventas atendidas" value={clp(revenue)} hint={`${done.length} citas · ticket ${clp(done.length ? revenue / done.length : 0)}`} />
        <Stat label="Tasa de inasistencia" value={pct(closed ? noShow.length / closed : 0)} hint={`${noShow.length} clientes no llegaron`} />
        <Stat label="Abonos retenidos" value={clp(keptDeposits)} hint="Lo que el abono te protegió" tone="up" />
        <Stat label="Reservas online" value={pct(nonCancelled ? online / nonCancelled : 0)} hint="Horas que no tuviste que agendar a mano" />
      </div>

      <Card className="mt-6">
        <CardHeader title="Por profesional" />
        <Table>
          <thead>
            <tr>
              <Th>Profesional</Th>
              <Th className="text-right">Atenciones</Th>
              <Th className="text-right">Ventas</Th>
              <Th className="text-right">Ticket promedio</Th>
              <Th className="text-right">Ocupación</Th>
              <Th className="text-right">Inasistencia</Th>
            </tr>
          </thead>
          <tbody>
            {byPro.map((r) => (
              <tr key={r.p.id}>
                <Td>
                  <span className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full" style={{ background: r.p.color }} />
                    {r.p.name}
                  </span>
                </Td>
                <Td className="text-right tabular-nums">{r.visits}</Td>
                <Td className="text-right tabular-nums">{clp(r.revenue)}</Td>
                <Td className="text-right tabular-nums">{clp(r.ticket)}</Td>
                <Td className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="hidden h-1.5 w-20 rounded-full bg-subtle sm:block">
                      <div className="h-1.5 rounded-full bg-brand" style={{ width: `${Math.min(100, r.occupancy * 100)}%` }} />
                    </div>
                    <span className="tabular-nums">{pct(r.occupancy)}</span>
                  </div>
                </Td>
                <Td className={cn("text-right tabular-nums", r.noShowRate > 0.1 && "text-red-600")}>{pct(r.noShowRate)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Ventas por servicio" />
          <BarList items={byService} format={clp} />
        </Card>
        <Card>
          <CardHeader title="Citas por día de la semana" subtitle="Útil para decidir turnos y promociones" />
          <BarList items={byWeekday} />
        </Card>
      </div>
    </>
  );
}

function todayLocalOf(d: Date, tz: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(d);
}
