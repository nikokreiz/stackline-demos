import { and, asc, eq } from "drizzle-orm";
import { PageHeader } from "@stackline/core/ui";
import { todayLocal } from "@stackline/core/time";
import { channels, products, warehouses } from "@/db/schema";
import { panel } from "@/lib/panel";
import { SaleForm } from "./sale-form";

export const metadata = { title: "Registrar venta" };

export default async function NuevaVenta() {
  const { db, orgId, tz } = await panel();
  const [chans, whs, prods] = await Promise.all([
    db.select().from(channels).where(and(eq(channels.orgId, orgId), eq(channels.active, true))),
    db.select().from(warehouses).where(eq(warehouses.orgId, orgId)).orderBy(asc(warehouses.name)),
    db.select().from(products).where(and(eq(products.orgId, orgId), eq(products.active, true))).orderBy(asc(products.name)),
  ]);
  return (
    <>
      <PageHeader title="Registrar venta" description="Descuenta stock al instante y calcula la comisión del canal." />
      <SaleForm
        today={todayLocal(tz)}
        channels={chans.map((c) => ({ id: c.id, name: c.name, kind: c.kind, commissionPct: c.commissionPct, fixedFee: c.fixedFee }))}
        warehouses={whs.map((w) => ({ id: w.id, name: w.name }))}
        products={prods.map((p) => ({ id: p.id, name: p.name, sku: p.sku, price: p.price, avgCost: p.avgCost }))}
      />
    </>
  );
}
