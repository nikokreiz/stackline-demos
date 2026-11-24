import { desc, eq, sql } from "drizzle-orm";
import { CheckCircle2, Plus } from "lucide-react";
import { clp, fmtDate } from "@stackline/core/format";
import { ButtonLink, Card, EmptyState, PageHeader, Table, Td, Th } from "@stackline/core/ui";
import { purchaseItems, purchases, suppliers, warehouses } from "@/db/schema";
import { canManage, panel } from "@/lib/panel";

export const metadata = { title: "Compras" };

export default async function ComprasPage({ searchParams }: { searchParams: Promise<{ nueva?: string }> }) {
  const { db, orgId, tz, session } = await panel();
  const rows = await db
    .select({
      p: purchases,
      supplier: suppliers.name,
      warehouse: warehouses.name,
      units: sql<number>`(select coalesce(sum(${purchaseItems.qty}), 0) from ${purchaseItems} where ${purchaseItems.purchaseId} = ${purchases.id})`.mapWith(Number),
    })
    .from(purchases)
    .leftJoin(suppliers, eq(suppliers.id, purchases.supplierId))
    .innerJoin(warehouses, eq(warehouses.id, purchases.warehouseId))
    .where(eq(purchases.orgId, orgId))
    .orderBy(desc(purchases.date))
    .limit(200);

  return (
    <>
      <PageHeader
        title="Compras a proveedores"
        description="Cada compra suma stock y actualiza el costo promedio de los productos."
        actions={canManage(session.role) && <ButtonLink href="/panel/compras/nueva"><Plus className="size-4" /> Registrar compra</ButtonLink>}
      />
      {(await searchParams).nueva && (
        <div className="mb-6 flex items-center gap-2 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
          <CheckCircle2 className="size-5" /> Compra registrada. El stock y los costos promedio ya están actualizados.
        </div>
      )}
      <Card>
        {rows.length === 0 ? (
          <EmptyState title="Aún no hay compras" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Fecha</Th>
                <Th>Proveedor</Th>
                <Th>Documento</Th>
                <Th>Bodega</Th>
                <Th className="text-right">Unidades</Th>
                <Th className="text-right">Total</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.p.id}>
                  <Td className="text-ink-soft">{fmtDate(r.p.date, tz)}</Td>
                  <Td>{r.supplier ?? "—"}</Td>
                  <Td className="text-ink-soft">{r.p.docNumber ?? "—"}</Td>
                  <Td>{r.warehouse}</Td>
                  <Td className="text-right tabular-nums">{r.units}</Td>
                  <Td className="text-right tabular-nums">{clp(r.p.total)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
