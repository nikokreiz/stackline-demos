import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { clp, num, pct } from "@stackline/core/format";
import { Badge, BarList, ButtonLink, Card, CardHeader, PageHeader, Stat, Table, Td, Th, cn } from "@stackline/core/ui";
import { todayLocal } from "@stackline/core/time";
import { dailyRevenue, isYm, lowStock, monthRange, periodSummary, productMargins } from "@/lib/metrics";
import { panel } from "@/lib/panel";

export const metadata = { title: "Resumen" };

export default async function ResumenPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { db, orgId, tz, session } = await panel();
  if (session.role === "staff") redirect("/panel/ventas");
  const sp = await searchParams;
  const currentYm = todayLocal(tz).slice(0, 7);
  const ym = isYm(sp.mes) && sp.mes <= currentYm ? sp.mes : currentYm;
  const r = monthRange(ym, tz);
  const prevR = monthRange(r.prev, tz);

  const [sum, prev, daily, margins, low] = await Promise.all([
    periodSummary(db, orgId, r.from, r.to),
    periodSummary(db, orgId, prevR.from, prevR.to),
    dailyRevenue(db, orgId, r.from, r.to, tz),
    productMargins(db, orgId, r.from, r.to),
    lowStock(db, orgId),
  ]);

  const delta = (a: number, b: number) => (b ? (a - b) / Math.abs(b) : 0);
  const revDelta = delta(sum.revenue, prev.revenue);
  const dailyMap = new Map(daily.map((d) => [d.day, d.revenue]));
  const days = Array.from({ length: r.daysInMonth }, (_, i) => `${ym}-${String(i + 1).padStart(2, "0")}`);
  const maxDay = Math.max(1, ...daily.map((d) => d.revenue));
  const isCurrent = ym === currentYm;

  const waterfall = [
    { label: "Ventas", value: sum.revenue, tone: "text-ink" },
    { label: "Costo de la mercadería", value: -sum.cogs, tone: "text-ink-soft" },
    { label: "Comisiones de canales", value: -sum.commission, tone: "text-ink-soft" },
    { label: "Envíos asumidos", value: -sum.shipping, tone: "text-ink-soft" },
    { label: "Margen de contribución", value: sum.margin, tone: "text-ink font-medium", border: true },
    { label: "Gastos del mes", value: -sum.expenses, tone: "text-ink-soft" },
    { label: "Ganancia real", value: sum.profit, tone: cn("font-semibold", sum.profit >= 0 ? "text-emerald-600" : "text-red-600"), border: true },
  ];

  return (
    <>
      <PageHeader
        title="Resumen"
        description={<span>{r.label}{isCurrent ? " (en curso)" : ""}</span>}
        actions={
          <>
            <div className="flex items-center rounded-lg border border-line bg-surface">
              <Link href={`?mes=${r.prev}`} className="p-2 hover:bg-subtle" aria-label="Mes anterior">
                <ChevronLeft className="size-4" />
              </Link>
              <span className="border-x border-line px-3 py-2 text-sm">{r.label}</span>
              {isCurrent ? (
                <span className="p-2 text-ink-faint">
                  <ChevronRight className="size-4" />
                </span>
              ) : (
                <Link href={`?mes=${r.next}`} className="p-2 hover:bg-subtle" aria-label="Mes siguiente">
                  <ChevronRight className="size-4" />
                </Link>
              )}
            </div>
            <ButtonLink href="/panel/ventas/nueva">
              <Plus className="size-4" /> Registrar venta
            </ButtonLink>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Ventas"
          value={clp(sum.revenue)}
          hint={`${num(sum.orders)} ventas · ${revDelta >= 0 ? "+" : ""}${pct(revDelta)} vs mes anterior`}
          tone={isCurrent ? undefined : revDelta >= 0 ? "up" : "down"}
        />
        <Stat label="Margen de contribución" value={clp(sum.margin)} hint={`${pct(sum.revenue ? sum.margin / sum.revenue : 0)} de las ventas`} />
        <Stat label="Gastos" value={clp(sum.expenses)} hint="Arriendo, sueldos, publicidad…" />
        <Stat
          label="Ganancia real"
          value={<span className={sum.profit >= 0 ? "text-emerald-600" : "text-red-600"}>{clp(sum.profit)}</span>}
          hint={isCurrent ? "Mes en curso: faltan días y gastos por registrar" : `Mes anterior: ${clp(prev.profit)}`}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Ventas por día" />
          <div className="flex h-48 items-end gap-1 px-5 pb-2 pt-6">
            {days.map((d) => {
              const v = dailyMap.get(d) ?? 0;
              return (
                <div key={d} className="group relative flex h-full flex-1 items-end">
                  <div className="w-full rounded-t bg-brand/80 transition group-hover:bg-brand" style={{ height: `${(v / maxDay) * 100}%`, minHeight: v ? 2 : 0 }} />
                  <span className="pointer-events-none absolute -top-6 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-ink px-1.5 py-0.5 text-[10px] text-canvas group-hover:block">
                    {Number(d.slice(8))}: {clp(v)}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between px-5 pb-4 text-xs text-ink-faint">
            <span>1</span>
            <span>{Math.ceil(r.daysInMonth / 2)}</span>
            <span>{r.daysInMonth}</span>
          </div>
        </Card>

        <Card>
          <CardHeader title="De las ventas a la ganancia" />
          <dl className="px-5 py-3 text-sm">
            {waterfall.map((w) => (
              <div key={w.label} className={cn("flex justify-between py-1.5", w.border && "mt-1 border-t border-line pt-2.5")}>
                <dt className={w.tone}>{w.label}</dt>
                <dd className={cn("tabular-nums", w.tone)}>{w.value < 0 ? `− ${clp(-w.value)}` : clp(w.value)}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Rentabilidad por canal" subtitle="Lo que realmente te deja cada canal después de comisiones y envíos" action={<Link href="/panel/canales" className="text-sm text-brand">Configurar comisiones</Link>} />
        <Table>
          <thead>
            <tr>
              <Th>Canal</Th>
              <Th className="text-right">Ventas</Th>
              <Th className="text-right">Monto</Th>
              <Th className="text-right">Costo</Th>
              <Th className="text-right">Comisiones</Th>
              <Th className="text-right">Envíos</Th>
              <Th className="text-right">Margen</Th>
              <Th className="text-right">Margen %</Th>
            </tr>
          </thead>
          <tbody>
            {sum.channels.map((c) => (
              <tr key={c.id}>
                <Td>
                  <span className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full" style={{ background: c.color }} />
                    {c.name}
                  </span>
                </Td>
                <Td className="text-right tabular-nums">{num(c.orders)}</Td>
                <Td className="text-right tabular-nums">{clp(c.revenue)}</Td>
                <Td className="text-right tabular-nums text-ink-soft">{clp(c.cogs)}</Td>
                <Td className="text-right tabular-nums text-ink-soft">{clp(c.commission)}</Td>
                <Td className="text-right tabular-nums text-ink-soft">{clp(c.shipping)}</Td>
                <Td className="text-right font-medium tabular-nums">{clp(c.margin)}</Td>
                <Td className="text-right">
                  <Badge tone={c.marginPct >= 0.45 ? "green" : c.marginPct >= 0.35 ? "amber" : "red"}>{pct(c.marginPct)}</Badge>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Productos que más te dejan" subtitle="Margen después de costo, comisión y envío prorrateados" />
          <BarList items={margins.slice(0, 8).map((m) => ({ label: m.name, value: Math.round(m.margin), hint: `${m.units} u.` }))} format={clp} />
          {margins.length > 8 && (
            <div className="border-t border-line px-5 py-3 text-sm">
              <span className="text-ink-soft">Menor margen: </span>
              {margins
                .slice(-3)
                .reverse()
                .map((m) => `${m.name} (${clp(m.margin)})`)
                .join(" · ")}
            </div>
          )}
        </Card>
        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <AlertTriangle className="size-4 text-amber-500" /> Stock bajo el mínimo
              </span>
            }
            action={<Link href="/panel/compras/nueva" className="text-sm text-brand">Registrar compra</Link>}
          />
          {low.length === 0 ? (
            <p className="px-5 py-4 text-sm text-ink-soft">Todo sobre el mínimo.</p>
          ) : (
            <ul className="divide-y divide-line">
              {low.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                  <Link href={`/panel/productos/${p.id}`} className="truncate hover:underline">
                    <span className="text-ink-soft">{p.sku}</span> · {p.name}
                  </Link>
                  <Badge tone={p.total === 0 ? "red" : "amber"}>
                    {p.total} / mín. {p.minStock}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
