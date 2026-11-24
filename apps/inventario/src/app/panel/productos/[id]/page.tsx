import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { clp, fmtDateTime, num, pct } from "@stackline/core/format";
import { Badge, Button, Card, CardHeader, Field, Input, PageHeader, Select, Stat, Table, Td, Th } from "@stackline/core/ui";
import { movements, products, stock, users, warehouses, type MovementType } from "@/db/schema";
import { canManage, panel } from "@/lib/panel";
import { adjustStockAction, saveProductAction, toggleProductAction, transferStockAction } from "../../actions";

export const metadata = { title: "Producto" };

const MOVE_LABEL: Record<MovementType, string> = {
  purchase: "Compra",
  sale: "Venta",
  sale_cancel: "Venta anulada",
  adjustment: "Ajuste",
  transfer_in: "Traslado (entra)",
  transfer_out: "Traslado (sale)",
  initial: "Stock inicial",
};

export default async function ProductoDetalle({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  const { db, orgId, tz, session } = await panel();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [p] = await db.select().from(products).where(and(eq(products.id, id), eq(products.orgId, orgId)));
  if (!p) notFound();
  const [whs, stk, moves] = await Promise.all([
    db.select().from(warehouses).where(eq(warehouses.orgId, orgId)).orderBy(asc(warehouses.name)),
    db.select().from(stock).where(eq(stock.productId, id)),
    db
      .select({ m: movements, whName: warehouses.name, userName: users.name })
      .from(movements)
      .innerJoin(warehouses, eq(warehouses.id, movements.warehouseId))
      .leftJoin(users, eq(users.id, movements.userId))
      .where(eq(movements.productId, id))
      .orderBy(desc(movements.createdAt))
      .limit(60),
  ]);
  const qtyIn = (w: string) => stk.find((s) => s.warehouseId === w)?.qty ?? 0;
  const total = stk.reduce((t, s) => t + s.qty, 0);
  const editable = canManage(session.role);
  const error = (await searchParams).error;

  return (
    <>
      <Link href="/panel/productos" className="mb-4 inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink">
        <ArrowLeft className="size-4" /> Productos
      </Link>
      <PageHeader title={p.name} description={`${p.sku} · ${p.category}`} actions={!p.active ? <Badge>Inactivo</Badge> : undefined} />
      {error && <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Stock total" value={num(total)} hint={whs.map((w) => `${w.name}: ${qtyIn(w.id)}`).join(" · ")} tone={total <= p.minStock ? "down" : undefined} />
        <Stat label="Costo promedio" value={clp(p.avgCost)} hint="Ponderado por compras" />
        <Stat label="Precio de venta" value={clp(p.price)} hint={`Margen bruto ${pct(p.price ? (p.price - p.avgCost) / p.price : 0)}`} />
        <Stat label="Valor en inventario" value={clp(Math.max(0, total) * p.avgCost)} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Kardex" subtitle="Últimos movimientos de stock" />
          <Table>
            <thead>
              <tr>
                <Th>Fecha</Th>
                <Th>Movimiento</Th>
                <Th>Bodega</Th>
                <Th className="text-right">Cant.</Th>
                <Th className="text-right">Saldo</Th>
                <Th className="text-right">Costo u.</Th>
                <Th>Usuario</Th>
              </tr>
            </thead>
            <tbody>
              {moves.map(({ m, whName, userName }) => (
                <tr key={m.id}>
                  <Td className="whitespace-nowrap text-ink-soft">{fmtDateTime(m.createdAt, tz)}</Td>
                  <Td>
                    {m.refType === "venta" && m.refId ? <Link href={`/panel/ventas/${m.refId}`} className="hover:underline">{MOVE_LABEL[m.type]}</Link> : MOVE_LABEL[m.type]}
                    {m.note && <p className="text-xs text-ink-soft">{m.note}</p>}
                  </Td>
                  <Td>{whName}</Td>
                  <Td className={m.qty > 0 ? "text-right tabular-nums text-emerald-600" : "text-right tabular-nums text-red-600"}>{m.qty > 0 ? `+${m.qty}` : m.qty}</Td>
                  <Td className="text-right tabular-nums">{m.balance}</Td>
                  <Td className="text-right tabular-nums text-ink-soft">{clp(m.unitCost)}</Td>
                  <Td className="text-ink-soft">{userName ?? "—"}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Trasladar entre bodegas" />
            <form action={transferStockAction.bind(null, p.id)} className="grid grid-cols-2 gap-3 px-5 py-4">
              <Field label="Desde">
                <Select name="from" defaultValue={whs.find((w) => w.name === "Bodega")?.id}>
                  {whs.map((w) => <option key={w.id} value={w.id}>{w.name} ({qtyIn(w.id)})</option>)}
                </Select>
              </Field>
              <Field label="Hacia">
                <Select name="to" defaultValue={whs.find((w) => w.name === "Tienda")?.id}>
                  {whs.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </Select>
              </Field>
              <Field label="Cantidad"><Input name="qty" type="number" min={1} required /></Field>
              <div className="flex items-end"><Button variant="secondary" className="w-full">Trasladar</Button></div>
            </form>
          </Card>

          {editable && (
            <>
              <Card>
                <CardHeader title="Ajuste por conteo" subtitle="Deja el stock en lo que contaste físicamente" />
                <form action={adjustStockAction.bind(null, p.id)} className="grid grid-cols-2 gap-3 px-5 py-4">
                  <Field label="Bodega">
                    <Select name="warehouseId">{whs.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</Select>
                  </Field>
                  <Field label="Cantidad real"><Input name="qty" type="number" min={0} required /></Field>
                  <div className="col-span-2"><Field label="Motivo"><Input name="note" placeholder="Conteo mensual, merma, regalo…" /></Field></div>
                  <div className="col-span-2"><Button variant="secondary" className="w-full">Guardar ajuste</Button></div>
                </form>
              </Card>
              <Card>
                <CardHeader title="Datos del producto" />
                <form action={saveProductAction.bind(null, p.id)} className="grid grid-cols-2 gap-3 px-5 py-4">
                  <Field label="SKU"><Input name="sku" defaultValue={p.sku} required /></Field>
                  <Field label="Categoría"><Input name="category" defaultValue={p.category} /></Field>
                  <div className="col-span-2"><Field label="Nombre"><Input name="name" defaultValue={p.name} required /></Field></div>
                  <Field label="Precio"><Input name="price" type="number" min={0} defaultValue={p.price} /></Field>
                  <Field label="Stock mínimo"><Input name="minStock" type="number" min={0} defaultValue={p.minStock} /></Field>
                  <div className="col-span-2"><Button className="w-full">Guardar</Button></div>
                </form>
                <form action={toggleProductAction.bind(null, p.id, !p.active)} className="border-t border-line px-5 py-3">
                  <Button variant="ghost" size="sm">{p.active ? "Desactivar producto" : "Reactivar producto"}</Button>
                </form>
              </Card>
            </>
          )}
        </div>
      </div>
    </>
  );
}
