import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { clp, fmtDateTime, pct } from "@stackline/core/format";
import { Badge, Button, Card, CardHeader, PageHeader, Table, Td, Th } from "@stackline/core/ui";
import { channels, products, saleItems, sales, users, warehouses } from "@/db/schema";
import { canManage, panel } from "@/lib/panel";
import { cancelSaleAction } from "../../actions";

export const metadata = { title: "Venta" };

export default async function VentaDetalle({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ nueva?: string }> }) {
  const { id } = await params;
  const { db, orgId, tz, session } = await panel();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [row] = await db
    .select({ sale: sales, channel: channels, warehouse: warehouses, userName: users.name })
    .from(sales)
    .innerJoin(channels, eq(channels.id, sales.channelId))
    .innerJoin(warehouses, eq(warehouses.id, sales.warehouseId))
    .leftJoin(users, eq(users.id, sales.userId))
    .where(and(eq(sales.id, id), eq(sales.orgId, orgId)));
  if (!row) notFound();
  const items = await db
    .select({ item: saleItems, name: products.name, sku: products.sku })
    .from(saleItems)
    .innerJoin(products, eq(products.id, saleItems.productId))
    .where(eq(saleItems.saleId, id));
  const { sale, channel, warehouse } = row;
  const margin = sale.total - sale.cogs - sale.commission - sale.shippingCost;
  const isNew = (await searchParams).nueva === "1";

  return (
    <>
      <Link href="/panel/ventas" className="mb-4 inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink">
        <ArrowLeft className="size-4" /> Ventas
      </Link>
      {isNew && (
        <div className="mb-6 flex items-center gap-2 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
          <CheckCircle2 className="size-5" /> Venta registrada y stock descontado de {warehouse.name}.
        </div>
      )}
      <PageHeader
        title={`Venta #${sale.number}`}
        description={`${fmtDateTime(sale.date, tz)} · ${channel.name} · sale de ${warehouse.name} · registró ${row.userName ?? "—"}`}
        actions={sale.status === "cancelled" ? <Badge tone="red">Anulada</Badge> : undefined}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Detalle" subtitle={[sale.customerName, sale.externalRef].filter(Boolean).join(" · ") || undefined} />
          <Table>
            <thead>
              <tr>
                <Th>Producto</Th>
                <Th className="text-right">Cant.</Th>
                <Th className="text-right">Precio</Th>
                <Th className="text-right">Costo prom.</Th>
                <Th className="text-right">Subtotal</Th>
              </tr>
            </thead>
            <tbody>
              {items.map(({ item, name, sku }) => (
                <tr key={item.id}>
                  <Td>
                    <Link href={`/panel/productos/${item.productId}`} className="hover:underline">
                      {name}
                    </Link>
                    <p className="text-xs text-ink-soft">{sku}</p>
                  </Td>
                  <Td className="text-right tabular-nums">{item.qty}</Td>
                  <Td className="text-right tabular-nums">{clp(item.unitPrice)}</Td>
                  <Td className="text-right tabular-nums text-ink-soft">{clp(item.unitCost)}</Td>
                  <Td className="text-right tabular-nums">{clp(item.qty * item.unitPrice)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
        <Card className="h-fit p-5">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between font-semibold"><dt>Total</dt><dd className="tabular-nums">{clp(sale.total)}</dd></div>
            <div className="flex justify-between text-ink-soft"><dt>Costo mercadería</dt><dd className="tabular-nums">− {clp(sale.cogs)}</dd></div>
            <div className="flex justify-between text-ink-soft"><dt>Comisión</dt><dd className="tabular-nums">− {clp(sale.commission)}</dd></div>
            <div className="flex justify-between text-ink-soft"><dt>Envío</dt><dd className="tabular-nums">− {clp(sale.shippingCost)}</dd></div>
            <div className="flex justify-between border-t border-line pt-2 font-semibold">
              <dt>Margen</dt>
              <dd className="tabular-nums">{clp(margin)} <span className="font-normal text-ink-soft">({pct(sale.total ? margin / sale.total : 0)})</span></dd>
            </div>
          </dl>
          {sale.status === "completed" && canManage(session.role) && (
            <form action={cancelSaleAction.bind(null, sale.id)} className="mt-5">
              <Button variant="ghost" className="w-full text-red-600">Anular venta y devolver stock</Button>
            </form>
          )}
        </Card>
      </div>
    </>
  );
}
