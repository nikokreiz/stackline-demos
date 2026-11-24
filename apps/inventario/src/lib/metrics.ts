import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { localToUtc } from "@stackline/core/time";
import type { Db } from "@/db";
import { channels, expenses, products, saleItems, sales, stock } from "@/db/schema";

const pad = (n: number) => String(n).padStart(2, "0");

export function monthRange(ym: string, tz: string) {
  const [y, m] = ym.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${pad(m + 1)}`;
  const prev = m === 1 ? `${y - 1}-12` : `${y}-${pad(m - 1)}`;
  return {
    from: localToUtc(`${ym}-01`, "00:00", tz),
    to: localToUtc(`${next}-01`, "00:00", tz),
    prev,
    next,
    daysInMonth: new Date(Date.UTC(y, m, 0)).getUTCDate(),
    label: (() => {
      const t = new Intl.DateTimeFormat("es-CL", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 15)));
      return t.charAt(0).toUpperCase() + t.slice(1);
    })(),
  };
}

export const isYm = (s: unknown): s is string => typeof s === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);

/** Resultado del período: de las ventas a la ganancia real, por canal. */
export async function periodSummary(db: Db, orgId: string, from: Date, to: Date) {
  const inRange = and(eq(sales.orgId, orgId), eq(sales.status, "completed"), gte(sales.date, from), lt(sales.date, to));
  const [byChannel, [exp], expByCat] = await Promise.all([
    db
      .select({
        id: channels.id,
        name: channels.name,
        color: channels.color,
        orders: sql<number>`count(${sales.id})`.mapWith(Number),
        revenue: sql<number>`coalesce(sum(${sales.total}), 0)`.mapWith(Number),
        cogs: sql<number>`coalesce(sum(${sales.cogs}), 0)`.mapWith(Number),
        commission: sql<number>`coalesce(sum(${sales.commission}), 0)`.mapWith(Number),
        shipping: sql<number>`coalesce(sum(${sales.shippingCost}), 0)`.mapWith(Number),
      })
      .from(channels)
      .leftJoin(sales, and(eq(sales.channelId, channels.id), inRange))
      .where(eq(channels.orgId, orgId))
      .groupBy(channels.id)
      .orderBy(desc(sql`coalesce(sum(${sales.total}), 0)`)),
    db
      .select({ total: sql<number>`coalesce(sum(${expenses.amount}), 0)`.mapWith(Number) })
      .from(expenses)
      .where(and(eq(expenses.orgId, orgId), gte(expenses.date, from), lt(expenses.date, to))),
    db
      .select({ category: expenses.category, total: sql<number>`sum(${expenses.amount})`.mapWith(Number) })
      .from(expenses)
      .where(and(eq(expenses.orgId, orgId), gte(expenses.date, from), lt(expenses.date, to)))
      .groupBy(expenses.category)
      .orderBy(desc(sql`sum(${expenses.amount})`)),
  ]);

  const channelsOut = byChannel.map((c) => {
    const margin = c.revenue - c.cogs - c.commission - c.shipping;
    return { ...c, margin, marginPct: c.revenue ? margin / c.revenue : 0 };
  });
  const sum = (k: "revenue" | "cogs" | "commission" | "shipping" | "orders" | "margin") =>
    channelsOut.reduce((t, c) => t + c[k], 0);
  const margin = sum("margin");
  return {
    channels: channelsOut,
    orders: sum("orders"),
    revenue: sum("revenue"),
    cogs: sum("cogs"),
    commission: sum("commission"),
    shipping: sum("shipping"),
    margin,
    expenses: exp.total,
    expensesByCategory: expByCat,
    profit: margin - exp.total,
  };
}

/** Ventas por día del período (hora local). */
export async function dailyRevenue(db: Db, orgId: string, from: Date, to: Date, tz: string) {
  const day = sql<string>`to_char(${sales.date} at time zone ${tz}, 'YYYY-MM-DD')`;
  return db
    .select({ day, revenue: sql<number>`sum(${sales.total})`.mapWith(Number) })
    .from(sales)
    .where(and(eq(sales.orgId, orgId), eq(sales.status, "completed"), gte(sales.date, from), lt(sales.date, to)))
    // Agrupar por posición: con parámetros, Postgres no reconoce la misma expresión repetida.
    .groupBy(sql`1`)
    .orderBy(sql`1`);
}

/** Margen por producto en el período (después de prorratear comisión y envío de cada venta). */
export async function productMargins(db: Db, orgId: string, from: Date, to: Date) {
  const share = sql`(${saleItems.qty} * ${saleItems.unitPrice})::float / nullif(${sales.total}, 0)`;
  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      sku: products.sku,
      units: sql<number>`sum(${saleItems.qty})`.mapWith(Number),
      revenue: sql<number>`sum(${saleItems.qty} * ${saleItems.unitPrice})`.mapWith(Number),
      margin: sql<number>`sum(${saleItems.qty} * (${saleItems.unitPrice} - ${saleItems.unitCost}) - ${share} * (${sales.commission} + ${sales.shippingCost}))`.mapWith(Number),
    })
    .from(saleItems)
    .innerJoin(sales, eq(sales.id, saleItems.saleId))
    .innerJoin(products, eq(products.id, saleItems.productId))
    .where(and(eq(sales.orgId, orgId), eq(sales.status, "completed"), gte(sales.date, from), lt(sales.date, to)))
    .groupBy(products.id);
  return rows.sort((a, b) => b.margin - a.margin);
}

/** Productos con stock total bajo su mínimo. */
export async function lowStock(db: Db, orgId: string) {
  const total = sql<number>`coalesce(sum(${stock.qty}), 0)`.mapWith(Number);
  const rows = await db
    .select({ id: products.id, name: products.name, sku: products.sku, minStock: products.minStock, total })
    .from(products)
    .leftJoin(stock, eq(stock.productId, products.id))
    .where(and(eq(products.orgId, orgId), eq(products.active, true)))
    .groupBy(products.id);
  return rows.filter((r) => r.total <= r.minStock).sort((a, b) => a.total - a.minStock - (b.total - b.minStock));
}
