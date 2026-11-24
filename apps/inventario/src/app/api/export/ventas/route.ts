import { and, asc, eq, gte, lt } from "drizzle-orm";
import { getSession } from "@stackline/core/auth";
import { toLocalDate, toLocalTime, todayLocal } from "@stackline/core/time";
import { getDb } from "@/db";
import { channels, sales } from "@/db/schema";
import { isYm, monthRange } from "@/lib/metrics";
import { csvResponse, toCsv } from "../csv";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const db = await getDb();
  const s = await getSession(db);
  if (!s) return new Response("No autorizado", { status: 401 });
  const tz = s.org.timezone;
  const mes = new URL(req.url).searchParams.get("mes");
  const ym = isYm(mes) ? mes : todayLocal(tz).slice(0, 7);
  const r = monthRange(ym, tz);
  const rows = await db
    .select({ s: sales, channel: channels.name })
    .from(sales)
    .innerJoin(channels, eq(channels.id, sales.channelId))
    .where(and(eq(sales.orgId, s.org.id), gte(sales.date, r.from), lt(sales.date, r.to)))
    .orderBy(asc(sales.date));
  return csvResponse(
    `ventas-${ym}.csv`,
    toCsv([
      ["numero", "fecha", "hora", "canal", "cliente", "referencia", "estado", "total", "costo", "comision", "envio", "margen"],
      ...rows.map(({ s: v, channel }) => [
        v.number,
        toLocalDate(v.date, tz),
        toLocalTime(v.date, tz),
        channel,
        v.customerName,
        v.externalRef,
        v.status === "completed" ? "completada" : "anulada",
        v.total,
        Math.round(v.cogs),
        v.commission,
        v.shippingCost,
        Math.round(v.total - v.cogs - v.commission - v.shippingCost),
      ]),
    ]),
  );
}
