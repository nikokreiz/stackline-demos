import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { fmtDateTime } from "@stackline/core/format";
import { Card, PageHeader, Select, Table, Td, Th } from "@stackline/core/ui";
import { MOVEMENT_TYPES, movements, products, users, warehouses, type MovementType } from "@/db/schema";
import { panel } from "@/lib/panel";

export const metadata = { title: "Movimientos" };

const LABEL: Record<MovementType, string> = {
  purchase: "Compra",
  sale: "Venta",
  sale_cancel: "Venta anulada",
  adjustment: "Ajuste",
  transfer_in: "Traslado (entra)",
  transfer_out: "Traslado (sale)",
  initial: "Stock inicial",
};

export default async function MovimientosPage({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  const { db, orgId, tz } = await panel();
  const wanted = (await searchParams).tipo;
  const tipo = MOVEMENT_TYPES.find((t) => t === wanted);
  const rows = await db
    .select({ m: movements, product: products.name, sku: products.sku, wh: warehouses.name, user: users.name })
    .from(movements)
    .innerJoin(products, eq(products.id, movements.productId))
    .innerJoin(warehouses, eq(warehouses.id, movements.warehouseId))
    .leftJoin(users, eq(users.id, movements.userId))
    .where(and(eq(movements.orgId, orgId), tipo ? eq(movements.type, tipo) : undefined))
    .orderBy(desc(movements.createdAt))
    .limit(200);

  return (
    <>
      <PageHeader title="Movimientos de stock" description="Historial auditable: quién movió qué, cuándo y a qué costo." />
      <Card>
        <form className="flex gap-3 border-b border-line p-4">
          <Select name="tipo" defaultValue={tipo ?? ""} className="w-auto">
            <option value="">Todos los tipos</option>
            {MOVEMENT_TYPES.map((t) => <option key={t} value={t}>{LABEL[t]}</option>)}
          </Select>
          <button className="h-10 rounded-lg border border-line px-4 text-sm hover:bg-subtle cursor-pointer">Filtrar</button>
        </form>
        <Table>
          <thead>
            <tr>
              <Th>Fecha</Th>
              <Th>Tipo</Th>
              <Th>Producto</Th>
              <Th>Bodega</Th>
              <Th className="text-right">Cant.</Th>
              <Th className="text-right">Saldo</Th>
              <Th>Usuario</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ m, product, sku, wh, user }) => (
              <tr key={m.id}>
                <Td className="whitespace-nowrap text-ink-soft">{fmtDateTime(m.createdAt, tz)}</Td>
                <Td>{LABEL[m.type]}{m.note && <p className="text-xs text-ink-soft">{m.note}</p>}</Td>
                <Td>
                  <Link href={`/panel/productos/${m.productId}`} className="hover:underline">{product}</Link>
                  <p className="text-xs text-ink-soft">{sku}</p>
                </Td>
                <Td>{wh}</Td>
                <Td className={m.qty > 0 ? "text-right tabular-nums text-emerald-600" : "text-right tabular-nums text-red-600"}>{m.qty > 0 ? `+${m.qty}` : m.qty}</Td>
                <Td className="text-right tabular-nums">{m.balance}</Td>
                <Td className="text-ink-soft">{user ?? "—"}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
