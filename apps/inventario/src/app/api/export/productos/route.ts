import { asc, eq, sql } from "drizzle-orm";
import { getSession } from "@stackline/core/auth";
import { getDb } from "@/db";
import { products, stock } from "@/db/schema";
import { csvResponse, toCsv } from "../csv";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = await getDb();
  const s = await getSession(db);
  if (!s) return new Response("No autorizado", { status: 401 });
  const rows = await db
    .select({ p: products, total: sql<number>`coalesce(sum(${stock.qty}), 0)`.mapWith(Number) })
    .from(products)
    .leftJoin(stock, eq(stock.productId, products.id))
    .where(eq(products.orgId, s.org.id))
    .groupBy(products.id)
    .orderBy(asc(products.sku));
  return csvResponse(
    "productos.csv",
    toCsv([
      ["sku", "nombre", "categoria", "precio", "costo", "stock", "stock_minimo"],
      ...rows.map((r) => [r.p.sku, r.p.name, r.p.category, r.p.price, Math.round(r.p.avgCost), r.total, r.p.minStock]),
    ]),
  );
}
