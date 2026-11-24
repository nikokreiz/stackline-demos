"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { logAudit } from "@stackline/core/audit";
import { isValidDateStr, localToUtc, todayLocal } from "@stackline/core/time";
import { resetDemo } from "@/db/seed";
import { channels, expenses, products, stock, warehouses } from "@/db/schema";
import { InventoryError, adjustStock, cancelSale, registerPurchase, registerSale, transferStock } from "@/lib/inventory";
import { canManage, panel } from "@/lib/panel";

async function manager() {
  const ctx = await panel();
  if (!canManage(ctx.session.role)) throw new Error("Solo la dueña o un administrador puede hacer este cambio.");
  return ctx;
}

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const int = (f: FormData, k: string) => Math.round(Number(str(f, k).replace(/\./g, "").replace(",", ".")) || 0);

/** Fecha elegida en el formulario a la hora actual (o al mediodía si es otro día). */
function dateAt(dateStr: string, tz: string) {
  if (!isValidDateStr(dateStr) || dateStr === todayLocal(tz)) return new Date();
  return localToUtc(dateStr, "12:00", tz);
}

const lineSchema = z.object({ productId: z.uuid(), qty: z.number().int().positive(), unit: z.number().int().min(0) });

// ---------- Ventas ----------

const saleSchema = z.object({
  channelId: z.uuid(),
  warehouseId: z.uuid(),
  date: z.string(),
  customerName: z.string().trim().max(80).optional(),
  externalRef: z.string().trim().max(60).optional(),
  shippingCost: z.number().int().min(0),
  lines: z.array(lineSchema).min(1, "Agrega al menos un producto."),
});

export async function createSaleAction(input: z.input<typeof saleSchema>): Promise<{ error?: string }> {
  const { db, orgId, tz, session } = await panel();
  const parsed = saleSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const d = parsed.data;
  let id: string;
  try {
    const sale = await registerSale(db, {
      orgId,
      userId: session.user.id,
      channelId: d.channelId,
      warehouseId: d.warehouseId,
      customerName: d.customerName || null,
      externalRef: d.externalRef || null,
      shippingCost: d.shippingCost,
      date: dateAt(d.date, tz),
      lines: d.lines,
    });
    id = sale.id;
    await logAudit(db, { orgId, userId: session.user.id, action: "registra", entity: "venta", entityId: id, data: { numero: sale.number, total: sale.total } });
  } catch (e) {
    if (e instanceof InventoryError) return { error: e.message };
    throw e;
  }
  revalidatePath("/panel", "layout");
  redirect(`/panel/ventas/${id}?nueva=1`);
}

export async function cancelSaleAction(saleId: string) {
  const { db, orgId, session } = await manager();
  if (await cancelSale(db, orgId, saleId, session.user.id)) {
    await logAudit(db, { orgId, userId: session.user.id, action: "anula", entity: "venta", entityId: saleId });
  }
  revalidatePath("/panel", "layout");
}

// ---------- Compras ----------

const purchaseSchema = z.object({
  supplierId: z.uuid().nullable(),
  warehouseId: z.uuid(),
  docNumber: z.string().trim().max(40).optional(),
  date: z.string(),
  lines: z.array(lineSchema).min(1, "Agrega al menos un producto."),
});

export async function createPurchaseAction(input: z.input<typeof purchaseSchema>): Promise<{ error?: string }> {
  const { db, orgId, tz, session } = await manager();
  const parsed = purchaseSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const d = parsed.data;
  try {
    const p = await registerPurchase(db, {
      orgId,
      userId: session.user.id,
      supplierId: d.supplierId,
      warehouseId: d.warehouseId,
      docNumber: d.docNumber || null,
      date: dateAt(d.date, tz),
      lines: d.lines,
    });
    await logAudit(db, { orgId, userId: session.user.id, action: "registra", entity: "compra", entityId: p.id, data: { total: p.total } });
  } catch (e) {
    if (e instanceof InventoryError) return { error: e.message };
    throw e;
  }
  revalidatePath("/panel", "layout");
  redirect("/panel/compras?nueva=1");
}

// ---------- Productos ----------

const productSchema = z.object({
  sku: z.string().trim().min(1, "Falta el SKU").max(40),
  name: z.string().trim().min(2, "Falta el nombre").max(120),
  category: z.string().trim().max(60).default("General"),
  price: z.number().int().min(0),
  minStock: z.number().int().min(0),
});

export async function saveProductAction(productId: string | null, form: FormData) {
  const { db, orgId, session } = await manager();
  const d = productSchema.parse({
    sku: str(form, "sku").toUpperCase(),
    name: str(form, "name"),
    category: str(form, "category") || "General",
    price: int(form, "price"),
    minStock: int(form, "minStock"),
  });
  let id = productId;
  if (productId) {
    await db.update(products).set(d).where(and(eq(products.id, productId), eq(products.orgId, orgId)));
  } else {
    const [p] = await db.insert(products).values({ ...d, orgId, avgCost: int(form, "cost") }).returning();
    id = p.id;
  }
  await logAudit(db, { orgId, userId: session.user.id, action: productId ? "edita" : "crea", entity: "producto", entityId: id, data: d });
  revalidatePath("/panel/productos", "layout");
  if (!productId) redirect(`/panel/productos/${id}`);
}

export async function toggleProductAction(productId: string, active: boolean) {
  const { db, orgId, session } = await manager();
  await db.update(products).set({ active }).where(and(eq(products.id, productId), eq(products.orgId, orgId)));
  await logAudit(db, { orgId, userId: session.user.id, action: active ? "activa" : "desactiva", entity: "producto", entityId: productId });
  revalidatePath("/panel/productos", "layout");
}

export async function adjustStockAction(productId: string, form: FormData) {
  const { db, orgId, session } = await manager();
  await adjustStock(db, {
    orgId,
    userId: session.user.id,
    productId,
    warehouseId: str(form, "warehouseId"),
    newQty: Math.max(0, int(form, "qty")),
    note: str(form, "note") || "Ajuste por conteo",
  });
  revalidatePath(`/panel/productos/${productId}`);
}

export async function transferStockAction(productId: string, form: FormData) {
  const { db, orgId, session } = await panel();
  try {
    await transferStock(db, {
      orgId,
      userId: session.user.id,
      productId,
      from: str(form, "from"),
      to: str(form, "to"),
      qty: int(form, "qty"),
    });
  } catch (e) {
    if (!(e instanceof InventoryError)) throw e;
    redirect(`/panel/productos/${productId}?error=${encodeURIComponent(e.message)}`);
  }
  revalidatePath(`/panel/productos/${productId}`);
}

/**
 * Importa productos desde CSV (columnas: sku, nombre, categoria, precio,
 * costo, stock, stock_minimo). Los SKU existentes se actualizan; el stock
 * inicial solo se carga en productos nuevos.
 */
export type ImportState = { message?: string; error?: string };

export async function importProductsAction(_prev: ImportState, form: FormData): Promise<ImportState> {
  const { db, orgId, session } = await manager();
  const file = form.get("file");
  const text = file instanceof File && file.size > 0 ? await file.text() : str(form, "csv");
  if (!text) return { error: "Sube un archivo o pega el contenido." };
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  const sep = (lines[0].match(/;/g)?.length ?? 0) > (lines[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const header = lines[0].split(sep).map((h) => h.trim().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, ""));
  const col = (name: string) => header.indexOf(name);
  if (col("sku") < 0 || col("nombre") < 0) return { error: "El archivo necesita al menos las columnas sku y nombre." };
  const [wh] = await db.select().from(warehouses).where(eq(warehouses.orgId, orgId)).limit(1);
  const num = (v: string | undefined) => Math.round(Number(String(v ?? "").replace(/[$\s.]/g, "").replace(",", ".")) || 0);

  let created = 0;
  let updated = 0;
  const errors: string[] = [];
  for (const [i, line] of lines.slice(1).entries()) {
    const cells = line.split(sep).map((c) => c.trim().replace(/^"|"$/g, ""));
    const sku = cells[col("sku")]?.toUpperCase();
    const name = cells[col("nombre")];
    if (!sku || !name) {
      errors.push(`Fila ${i + 2}: falta sku o nombre`);
      continue;
    }
    const values = {
      name,
      category: (col("categoria") >= 0 && cells[col("categoria")]) || "General",
      price: num(cells[col("precio")]),
      minStock: num(cells[col("stock_minimo")]),
    };
    const [existing] = await db.select().from(products).where(and(eq(products.orgId, orgId), eq(products.sku, sku)));
    if (existing) {
      await db.update(products).set(values).where(eq(products.id, existing.id));
      updated++;
    } else {
      const [p] = await db.insert(products).values({ ...values, sku, orgId, avgCost: num(cells[col("costo")]) }).returning();
      const qty = num(cells[col("stock")]);
      if (qty > 0 && wh) await adjustStock(db, { orgId, userId: session.user.id, productId: p.id, warehouseId: wh.id, newQty: qty, note: "Stock inicial (importación)" });
      created++;
    }
  }
  await logAudit(db, { orgId, userId: session.user.id, action: "importa", entity: "producto", data: { created, updated } });
  revalidatePath("/panel/productos", "layout");
  return { message: `${created} productos creados y ${updated} actualizados.${errors.length ? ` ${errors.length} filas con error: ${errors.slice(0, 3).join("; ")}` : ""}` };
}

// ---------- Gastos y canales ----------

export async function addExpenseAction(form: FormData) {
  const { db, orgId, tz, session } = await manager();
  const amount = int(form, "amount");
  const date = str(form, "date");
  if (amount <= 0 || !isValidDateStr(date)) return;
  const [e] = await db
    .insert(expenses)
    .values({ orgId, date: localToUtc(date, "12:00", tz), category: str(form, "category") || "Otros", description: str(form, "description") || null, amount, userId: session.user.id })
    .returning();
  await logAudit(db, { orgId, userId: session.user.id, action: "registra", entity: "gasto", entityId: e.id, data: { amount } });
  revalidatePath("/panel", "layout");
}

export async function deleteExpenseAction(id: string) {
  const { db, orgId, session } = await manager();
  await db.delete(expenses).where(and(eq(expenses.id, id), eq(expenses.orgId, orgId)));
  await logAudit(db, { orgId, userId: session.user.id, action: "elimina", entity: "gasto", entityId: id });
  revalidatePath("/panel", "layout");
}

export async function saveChannelAction(channelId: string, form: FormData) {
  const { db, orgId, session } = await manager();
  const commissionPct = Math.min(100, Math.max(0, Number(str(form, "commissionPct").replace(",", ".")) || 0));
  const fixedFee = Math.max(0, int(form, "fixedFee"));
  await db.update(channels).set({ commissionPct, fixedFee, name: str(form, "name") || undefined }).where(and(eq(channels.id, channelId), eq(channels.orgId, orgId)));
  await logAudit(db, { orgId, userId: session.user.id, action: "edita", entity: "canal", entityId: channelId, data: { commissionPct, fixedFee } });
  revalidatePath("/panel", "layout");
}

export async function resetDemoAction() {
  const { db, session } = await panel();
  if (session.role !== "owner") throw new Error("Solo la dueña puede reiniciar la demo.");
  await resetDemo(db);
  redirect("/login");
}

/** Stock disponible de una bodega, para el formulario de venta. */
export async function stockForWarehouseAction(warehouseId: string) {
  const { db, orgId } = await panel();
  const rows = await db
    .select({ productId: stock.productId, qty: stock.qty })
    .from(stock)
    .innerJoin(products, eq(products.id, stock.productId))
    .where(and(eq(stock.warehouseId, warehouseId), eq(products.orgId, orgId)));
  return Object.fromEntries(rows.map((r) => [r.productId, r.qty])) as Record<string, number>;
}
