import { and, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { channels, movements, products, purchaseItems, purchases, saleItems, sales, stock, warehouses, type MovementType } from "@/db/schema";

export class InventoryError extends Error {}

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** Comisión de un canal para un total dado: porcentaje + cargo fijo. */
export function commissionFor(ch: { commissionPct: number; fixedFee: number }, total: number) {
  return total > 0 ? Math.round((total * ch.commissionPct) / 100) + ch.fixedFee : 0;
}

/** Suma (o resta) stock en una bodega y registra el movimiento en el kardex. */
async function move(
  tx: Tx,
  m: {
    orgId: string;
    productId: string;
    warehouseId: string;
    qty: number;
    type: MovementType;
    unitCost: number;
    refType?: string;
    refId?: string;
    note?: string | null;
    userId: string | null;
    allowNegative?: boolean;
  },
) {
  const [row] = await tx
    .insert(stock)
    .values({ productId: m.productId, warehouseId: m.warehouseId, qty: m.qty })
    .onConflictDoUpdate({ target: [stock.productId, stock.warehouseId], set: { qty: sql`${stock.qty} + ${m.qty}` } })
    .returning({ qty: stock.qty });
  if (row.qty < 0 && !m.allowNegative) {
    const [p] = await tx.select({ name: products.name }).from(products).where(eq(products.id, m.productId));
    throw new InventoryError(`No hay stock suficiente de “${p?.name ?? "producto"}” (faltan ${-row.qty}).`);
  }
  await tx.insert(movements).values({
    orgId: m.orgId,
    productId: m.productId,
    warehouseId: m.warehouseId,
    type: m.type,
    qty: m.qty,
    unitCost: m.unitCost,
    balance: row.qty,
    refType: m.refType ?? null,
    refId: m.refId ?? null,
    note: m.note ?? null,
    userId: m.userId,
  });
}

async function assertWarehouse(tx: Tx, orgId: string, warehouseId: string) {
  const [w] = await tx.select({ id: warehouses.id }).from(warehouses).where(and(eq(warehouses.id, warehouseId), eq(warehouses.orgId, orgId)));
  if (!w) throw new InventoryError("Bodega no encontrada.");
}

async function loadProducts(tx: Tx, orgId: string, ids: string[]) {
  const rows = await tx
    .select()
    .from(products)
    .where(and(eq(products.orgId, orgId), inArray(products.id, ids)))
    .for("update");
  if (rows.length !== new Set(ids).size) throw new InventoryError("Hay productos que no existen.");
  return new Map(rows.map((r) => [r.id, r]));
}

export type Line = { productId: string; qty: number; unit: number };

function cleanLines(lines: Line[]) {
  const ok = lines.filter((l) => l.productId && l.qty > 0);
  if (ok.length === 0) throw new InventoryError("Agrega al menos un producto.");
  return ok;
}

/**
 * Registra una compra: suma stock y recalcula el costo promedio ponderado
 * de cada producto con el stock total (todas las bodegas).
 */
export async function registerPurchase(
  db: Db,
  input: { orgId: string; userId: string; supplierId: string | null; warehouseId: string; docNumber: string | null; date: Date; lines: Line[] },
) {
  const lines = cleanLines(input.lines);
  return db.transaction(async (tx) => {
    await assertWarehouse(tx, input.orgId, input.warehouseId);
    const prods = await loadProducts(tx, input.orgId, lines.map((l) => l.productId));
    const [purchase] = await tx
      .insert(purchases)
      .values({
        orgId: input.orgId,
        supplierId: input.supplierId,
        warehouseId: input.warehouseId,
        docNumber: input.docNumber,
        total: lines.reduce((t, l) => t + l.qty * l.unit, 0),
        date: input.date,
        userId: input.userId,
      })
      .returning();
    for (const l of lines) {
      const [{ total }] = await tx
        .select({ total: sql<number>`coalesce(sum(${stock.qty}), 0)`.mapWith(Number) })
        .from(stock)
        .where(eq(stock.productId, l.productId));
      const p = prods.get(l.productId)!;
      const base = Math.max(0, total);
      const newAvg = (base * p.avgCost + l.qty * l.unit) / (base + l.qty);
      await tx.update(products).set({ avgCost: newAvg }).where(eq(products.id, p.id));
      p.avgCost = newAvg;
      await tx.insert(purchaseItems).values({ purchaseId: purchase.id, productId: l.productId, qty: l.qty, unitCost: l.unit });
      await move(tx, {
        orgId: input.orgId,
        productId: l.productId,
        warehouseId: input.warehouseId,
        qty: l.qty,
        type: "purchase",
        unitCost: l.unit,
        refType: "compra",
        refId: purchase.id,
        userId: input.userId,
      });
    }
    return purchase;
  });
}

/**
 * Registra una venta: descuenta stock (falla si no alcanza), guarda el costo
 * promedio del momento y calcula la comisión del canal.
 */
export async function registerSale(
  db: Db,
  input: {
    orgId: string;
    userId: string;
    channelId: string;
    warehouseId: string;
    customerName: string | null;
    externalRef: string | null;
    shippingCost: number;
    date: Date;
    lines: Line[];
  },
) {
  const lines = cleanLines(input.lines);
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"sale:" + input.orgId}))`);
    await assertWarehouse(tx, input.orgId, input.warehouseId);
    const [ch] = await tx.select().from(channels).where(and(eq(channels.id, input.channelId), eq(channels.orgId, input.orgId)));
    if (!ch) throw new InventoryError("Canal no encontrado.");
    const prods = await loadProducts(tx, input.orgId, lines.map((l) => l.productId));
    const total = lines.reduce((t, l) => t + l.qty * l.unit, 0);
    const cogs = lines.reduce((t, l) => t + l.qty * prods.get(l.productId)!.avgCost, 0);
    const [{ next }] = await tx
      .select({ next: sql<number>`coalesce(max(${sales.number}), 1000) + 1`.mapWith(Number) })
      .from(sales)
      .where(eq(sales.orgId, input.orgId));
    const [sale] = await tx
      .insert(sales)
      .values({
        orgId: input.orgId,
        number: next,
        channelId: ch.id,
        warehouseId: input.warehouseId,
        customerName: input.customerName,
        externalRef: input.externalRef,
        total,
        commission: commissionFor(ch, total),
        shippingCost: Math.max(0, input.shippingCost),
        cogs,
        date: input.date,
        userId: input.userId,
      })
      .returning();
    for (const l of lines) {
      const p = prods.get(l.productId)!;
      await tx.insert(saleItems).values({ saleId: sale.id, productId: p.id, qty: l.qty, unitPrice: l.unit, unitCost: p.avgCost });
      await move(tx, {
        orgId: input.orgId,
        productId: p.id,
        warehouseId: input.warehouseId,
        qty: -l.qty,
        type: "sale",
        unitCost: p.avgCost,
        refType: "venta",
        refId: sale.id,
        userId: input.userId,
      });
    }
    return sale;
  });
}

/** Anula una venta y devuelve el stock a la bodega de origen. */
export async function cancelSale(db: Db, orgId: string, saleId: string, userId: string) {
  return db.transaction(async (tx) => {
    const [sale] = await tx.select().from(sales).where(and(eq(sales.id, saleId), eq(sales.orgId, orgId))).for("update");
    if (!sale || sale.status === "cancelled") return false;
    const items = await tx.select().from(saleItems).where(eq(saleItems.saleId, saleId));
    for (const i of items) {
      await move(tx, {
        orgId,
        productId: i.productId,
        warehouseId: sale.warehouseId,
        qty: i.qty,
        type: "sale_cancel",
        unitCost: i.unitCost,
        refType: "venta",
        refId: sale.id,
        note: `Anulación venta #${sale.number}`,
        userId,
      });
    }
    await tx.update(sales).set({ status: "cancelled" }).where(eq(sales.id, saleId));
    return true;
  });
}

/** Ajuste por conteo físico: deja el stock de una bodega en la cantidad indicada. */
export async function adjustStock(
  db: Db,
  input: { orgId: string; userId: string; productId: string; warehouseId: string; newQty: number; note: string | null },
) {
  return db.transaction(async (tx) => {
    await assertWarehouse(tx, input.orgId, input.warehouseId);
    const prods = await loadProducts(tx, input.orgId, [input.productId]);
    const [current] = await tx
      .select({ qty: stock.qty })
      .from(stock)
      .where(and(eq(stock.productId, input.productId), eq(stock.warehouseId, input.warehouseId)));
    const diff = input.newQty - (current?.qty ?? 0);
    if (diff === 0) return;
    await move(tx, {
      orgId: input.orgId,
      productId: input.productId,
      warehouseId: input.warehouseId,
      qty: diff,
      type: "adjustment",
      unitCost: prods.get(input.productId)!.avgCost,
      note: input.note,
      userId: input.userId,
    });
  });
}

/** Traslado entre bodegas (por ejemplo, de bodega a la tienda). */
export async function transferStock(
  db: Db,
  input: { orgId: string; userId: string; productId: string; from: string; to: string; qty: number },
) {
  if (input.from === input.to || input.qty <= 0) throw new InventoryError("Traslado inválido.");
  return db.transaction(async (tx) => {
    await assertWarehouse(tx, input.orgId, input.from);
    await assertWarehouse(tx, input.orgId, input.to);
    const prods = await loadProducts(tx, input.orgId, [input.productId]);
    const cost = prods.get(input.productId)!.avgCost;
    const base = { orgId: input.orgId, productId: input.productId, unitCost: cost, userId: input.userId, refType: "traslado" };
    await move(tx, { ...base, warehouseId: input.from, qty: -input.qty, type: "transfer_out" });
    await move(tx, { ...base, warehouseId: input.to, qty: input.qty, type: "transfer_in" });
  });
}
