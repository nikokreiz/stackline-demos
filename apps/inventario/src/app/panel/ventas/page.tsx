import Link from "next/link";
import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { Download, Plus } from "lucide-react";
import { clp, fmtDateTime } from "@stackline/core/format";
import { Badge, ButtonLink, Card, EmptyState, PageHeader, Select, Table, Td, Th } from "@stackline/core/ui";
import { todayLocal } from "@stackline/core/time";
import { channels, saleItems, sales } from "@/db/schema";
import { isYm, monthRange } from "@/lib/metrics";
import { panel } from "@/lib/panel";

export const metadata = { title: "Ventas" };

export default async function VentasPage({ searchParams }: { searchParams: Promise<{ mes?: string; canal?: string }> }) {
  const { db, orgId, tz } = await panel();
  const sp = await searchParams;
  const ym = isYm(sp.mes) ? sp.mes : todayLocal(tz).slice(0, 7);
  const r = monthRange(ym, tz);
  const chans = await db.select().from(channels).where(eq(channels.orgId, orgId));
  const canal = chans.find((c) => c.id === sp.canal)?.id;

  const rows = await db
    .select({
      sale: sales,
      channelName: channels.name,
      channelColor: channels.color,
      units: sql<number>`(select coalesce(sum(${saleItems.qty}), 0) from ${saleItems} where ${saleItems.saleId} = ${sales.id})`.mapWith(Number),
    })
    .from(sales)
    .innerJoin(channels, eq(channels.id, sales.channelId))
    .where(and(eq(sales.orgId, orgId), gte(sales.date, r.from), lt(sales.date, r.to), canal ? eq(sales.channelId, canal) : undefined))
    .orderBy(desc(sales.date))
    .limit(500);

  return (
    <>
      <PageHeader
        title="Ventas"
        description={<span>{r.label} · {rows.length} ventas</span>}
        actions={
          <>
            <a
              href={`/api/export/ventas?mes=${ym}`}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-line bg-surface px-4 text-sm font-medium hover:bg-subtle"
            >
              <Download className="size-4" /> Exportar CSV
            </a>
            <ButtonLink href="/panel/ventas/nueva">
              <Plus className="size-4" /> Registrar venta
            </ButtonLink>
          </>
        }
      />
      <Card>
        <form className="flex flex-wrap gap-3 border-b border-line p-4">
          <input type="month" name="mes" defaultValue={ym} className="h-10 rounded-lg border border-line bg-surface px-3 text-sm" />
          <Select name="canal" defaultValue={canal ?? ""} className="w-auto">
            <option value="">Todos los canales</option>
            {chans.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <button className="h-10 rounded-lg border border-line px-4 text-sm hover:bg-subtle cursor-pointer">Filtrar</button>
        </form>
        {rows.length === 0 ? (
          <EmptyState title="Sin ventas en este período" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>N°</Th>
                <Th>Fecha</Th>
                <Th>Canal</Th>
                <Th>Cliente</Th>
                <Th className="text-right">Unid.</Th>
                <Th className="text-right">Total</Th>
                <Th className="text-right">Margen</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ sale, channelName, channelColor, units }) => {
                const margin = sale.total - sale.cogs - sale.commission - sale.shippingCost;
                return (
                  <tr key={sale.id} className={sale.status === "cancelled" ? "opacity-50" : "hover:bg-subtle"}>
                    <Td>
                      <Link href={`/panel/ventas/${sale.id}`} className="font-medium hover:underline">
                        #{sale.number}
                      </Link>
                    </Td>
                    <Td className="whitespace-nowrap text-ink-soft">{fmtDateTime(sale.date, tz)}</Td>
                    <Td>
                      <span className="flex items-center gap-2 whitespace-nowrap">
                        <span className="size-2 rounded-full" style={{ background: channelColor }} />
                        {channelName}
                      </span>
                    </Td>
                    <Td className="text-ink-soft">{sale.customerName ?? "—"}</Td>
                    <Td className="text-right tabular-nums">{units}</Td>
                    <Td className="text-right tabular-nums">{clp(sale.total)}</Td>
                    <Td className="text-right tabular-nums">{sale.status === "cancelled" ? "—" : clp(margin)}</Td>
                    <Td>{sale.status === "cancelled" && <Badge tone="red">Anulada</Badge>}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
