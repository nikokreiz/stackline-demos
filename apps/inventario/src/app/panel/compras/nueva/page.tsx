import { and, asc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { PageHeader } from "@stackline/core/ui";
import { todayLocal } from "@stackline/core/time";
import { products, suppliers, warehouses } from "@/db/schema";
import { canManage, panel } from "@/lib/panel";
import { PurchaseForm } from "./purchase-form";

export const metadata = { title: "Registrar compra" };

export default async function NuevaCompra() {
  const { db, orgId, tz, session } = await panel();
  if (!canManage(session.role)) redirect("/panel/compras");
  const [sups, whs, prods] = await Promise.all([
    db.select().from(suppliers).where(eq(suppliers.orgId, orgId)).orderBy(asc(suppliers.name)),
    db.select().from(warehouses).where(eq(warehouses.orgId, orgId)).orderBy(asc(warehouses.name)),
    db.select().from(products).where(and(eq(products.orgId, orgId), eq(products.active, true))).orderBy(asc(products.name)),
  ]);
  return (
    <>
      <PageHeader title="Registrar compra" description="Ingresa la factura del proveedor: suma stock y recalcula el costo promedio." />
      <PurchaseForm
        today={todayLocal(tz)}
        suppliers={sups.map((s) => ({ id: s.id, name: s.name }))}
        warehouses={whs.map((w) => ({ id: w.id, name: w.name }))}
        products={prods.map((p) => ({ id: p.id, name: p.name, sku: p.sku, avgCost: p.avgCost }))}
      />
    </>
  );
}
