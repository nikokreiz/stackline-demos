import { count, eq, inArray } from "drizzle-orm";
import { hashPassword } from "@stackline/core/auth";
import type { AppDb } from "@stackline/core/db";
import { addDaysStr, localToUtc, minutesToHHMM, todayLocal } from "@stackline/core/time";
import * as s from "./schema";

type Db = AppDb<typeof s>;

export const DEMO_SLUG = "casa-nativa";
export const DEMO_USERS = {
  owner: { email: "dueno@demo.cl", password: "demo1234", name: "Paula Henríquez" },
  staff: { email: "vendedor@demo.cl", password: "demo1234", name: "Tomás Carrasco" },
};
const TZ = "America/Santiago";

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

export async function seedIfEmpty(db: Db) {
  const [{ n }] = await db.select({ n: count() }).from(s.organizations);
  if (n === 0) await seedDemo(db);
}

export async function resetDemo(db: Db) {
  await db.delete(s.organizations).where(eq(s.organizations.slug, DEMO_SLUG));
  await db.delete(s.users).where(inArray(s.users.email, [DEMO_USERS.owner.email, DEMO_USERS.staff.email]));
  await seedDemo(db);
}

// [sku, nombre, categoría, precio, costo, stock mínimo]
const CATALOG: Array<[string, string, string, number, number, number]> = [
  ["VEL-001", "Vela de soya lavanda 200 g", "Velas y aromas", 9990, 3800, 8],
  ["VEL-002", "Vela de soya vainilla 200 g", "Velas y aromas", 9990, 3800, 8],
  ["VEL-003", "Vela en vaso de cerámica", "Velas y aromas", 14990, 6200, 5],
  ["VEL-004", "Set 3 velas mini", "Velas y aromas", 12990, 4900, 6],
  ["ARO-001", "Difusor de varillas eucalipto", "Velas y aromas", 13990, 5400, 6],
  ["ARO-002", "Spray textil lavanda", "Velas y aromas", 7990, 2900, 6],
  ["ARO-003", "Palo santo (pack 6)", "Velas y aromas", 4990, 1700, 10],
  ["TEX-001", "Cojín lino natural 45x45", "Textiles", 16990, 7500, 5],
  ["TEX-002", "Cojín tejido mostaza", "Textiles", 18990, 8200, 4],
  ["TEX-003", "Funda cojín terciopelo verde", "Textiles", 11990, 4600, 5],
  ["TEX-004", "Manta tejida a telar", "Textiles", 39990, 19000, 3],
  ["TEX-005", "Pie de cama chenille", "Textiles", 29990, 13500, 3],
  ["CER-001", "Taza artesanal esmaltada", "Cerámica", 8990, 3500, 10],
  ["CER-002", "Set 2 tazas espresso", "Cerámica", 12990, 5200, 5],
  ["CER-003", "Plato de cerámica 26 cm", "Cerámica", 10990, 4300, 6],
  ["CER-004", "Florero cerámica blanco", "Cerámica", 15990, 6800, 4],
  ["MAC-001", "Macetero de greda mediano", "Plantas", 7990, 2900, 8],
  ["MAC-002", "Macetero colgante macramé", "Plantas", 13990, 5100, 4],
  ["MAC-003", "Macetero cemento geométrico", "Plantas", 9990, 3700, 6],
  ["LAM-001", "Lámina botánica A3", "Láminas y marcos", 6990, 1800, 10],
  ["LAM-002", "Lámina mapa de Chile A3", "Láminas y marcos", 7990, 2000, 8],
  ["LAM-003", "Marco madera nativa A3", "Láminas y marcos", 14990, 6500, 5],
  ["COC-001", "Tabla de raulí para picoteo", "Cocina", 19990, 8900, 4],
  ["COC-002", "Individuales de yute (set 4)", "Cocina", 15990, 6500, 4],
  ["COC-003", "Paño de cocina estampado", "Cocina", 5990, 2100, 10],
  ["DEC-001", "Espejo redondo de mimbre", "Decoración", 34990, 16500, 2],
  ["DEC-002", "Canasto de totora grande", "Decoración", 22990, 9800, 3],
  ["DEC-003", "Portavelas de bronce", "Decoración", 11990, 4900, 4],
  ["DEC-004", "Reloj de muro de madera", "Decoración", 27990, 12900, 2],
  ["DEC-005", "Bandeja de mimbre", "Decoración", 17990, 7600, 3],
];

const NAMES = [
  "Carolina Vega", "Fernanda Lagos", "Ignacia Bravo", "Macarena Ortiz", "Daniela Salinas", "Javiera Cortés",
  "Francisca Núñez", "Camila Riquelme", "Andrea Molina", "Valentina Figueroa", "Pablo Leiva", "Cristian Paredes",
];

async function seedDemo(db: Db) {
  const rand = rng(424242);
  const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)];
  const between = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));

  const [org] = await db
    .insert(s.organizations)
    .values({
      slug: DEMO_SLUG,
      name: "Casa Nativa",
      timezone: TZ,
      settings: { address: "Barrio Italia, Providencia", instagram: "@casanativa.deco" },
    })
    .returning();
  const [owner, staff] = await db
    .insert(s.users)
    .values([
      { email: DEMO_USERS.owner.email, name: DEMO_USERS.owner.name, passwordHash: await hashPassword(DEMO_USERS.owner.password) },
      { email: DEMO_USERS.staff.email, name: DEMO_USERS.staff.name, passwordHash: await hashPassword(DEMO_USERS.staff.password) },
    ])
    .returning();
  await db.insert(s.memberships).values([
    { orgId: org.id, userId: owner.id, role: "owner" },
    { orgId: org.id, userId: staff.id, role: "staff" },
  ]);

  const [bodega, tienda] = await db
    .insert(s.warehouses)
    .values([
      { orgId: org.id, name: "Bodega" },
      { orgId: org.id, name: "Tienda" },
    ])
    .returning();

  const chans = await db
    .insert(s.channels)
    .values([
      { orgId: org.id, name: "Tienda física", kind: "local", commissionPct: 2.5, fixedFee: 0, color: "#0f766e" },
      { orgId: org.id, name: "Instagram / WhatsApp", kind: "instagram", commissionPct: 0, fixedFee: 0, color: "#c026d3" },
      { orgId: org.id, name: "Mercado Libre", kind: "mercadolibre", commissionPct: 14, fixedFee: 700, color: "#ca8a04" },
      { orgId: org.id, name: "Tienda web", kind: "web", commissionPct: 3.19, fixedFee: 0, color: "#4f46e5" },
    ])
    .returning();
  const [local, insta, meli, web] = chans;

  const sups = await db
    .insert(s.suppliers)
    .values([
      { orgId: org.id, name: "Taller Cera Viva", contact: "+56 9 6123 4567" },
      { orgId: org.id, name: "Tejidos del Sur", contact: "ventas@tejidosdelsur.cl" },
      { orgId: org.id, name: "Cerámica Pomaire Ltda.", contact: "+56 9 7788 1122" },
      { orgId: org.id, name: "Importadora Andes", contact: "contacto@importandes.cl" },
    ])
    .returning();
  const supplierFor = (cat: string) =>
    cat === "Velas y aromas" ? sups[0] : cat === "Textiles" ? sups[1] : cat === "Cerámica" || cat === "Plantas" ? sups[2] : sups[3];

  const prods = await db
    .insert(s.products)
    .values(CATALOG.map(([sku, name, category, price, , minStock]) => ({ orgId: org.id, sku, name, category, price, minStock })))
    .returning();
  const baseCost = new Map(prods.map((p, i) => [p.id, CATALOG[i][4]]));

  // ---- Simulación en memoria: compras, ventas y costo promedio día a día ----
  const qty = new Map<string, number>(); // `${prod}:${wh}`
  const avg = new Map<string, number>(prods.map((p) => [p.id, 0]));
  const key = (p: string, w: string) => `${p}:${w}`;
  const totalQty = (p: string) => (qty.get(key(p, bodega.id)) ?? 0) + (qty.get(key(p, tienda.id)) ?? 0);

  const purchaseRows: Array<typeof s.purchases.$inferInsert & { id: string }> = [];
  const purchaseItemRows: Array<typeof s.purchaseItems.$inferInsert> = [];
  const saleRows: Array<typeof s.sales.$inferInsert & { id: string }> = [];
  const saleItemRows: Array<typeof s.saleItems.$inferInsert> = [];
  const movementRows: Array<typeof s.movements.$inferInsert> = [];
  const uuid = () => crypto.randomUUID();

  const today = todayLocal(TZ);
  const at = (offset: number, minutes: number) => localToUtc(addDaysStr(today, offset), minutesToHHMM(minutes), TZ);
  let docNo = 3100;

  function buy(offset: number, wh: string, items: Array<{ p: (typeof prods)[number]; q: number; cost: number }>, supplierId: string) {
    const id = uuid();
    const date = at(offset, 9 * 60 + between(0, 90));
    purchaseRows.push({
      id,
      orgId: org.id,
      supplierId,
      warehouseId: wh,
      docNumber: `F-${docNo++}`,
      total: items.reduce((t, i) => t + i.q * i.cost, 0),
      date,
      userId: owner.id,
      createdAt: date,
    });
    for (const i of items) {
      const prev = totalQty(i.p.id);
      const newAvg = (prev * avg.get(i.p.id)! + i.q * i.cost) / (prev + i.q);
      avg.set(i.p.id, newAvg);
      const k = key(i.p.id, wh);
      qty.set(k, (qty.get(k) ?? 0) + i.q);
      purchaseItemRows.push({ purchaseId: id, productId: i.p.id, qty: i.q, unitCost: i.cost });
      movementRows.push({
        orgId: org.id,
        productId: i.p.id,
        warehouseId: wh,
        type: "purchase",
        qty: i.q,
        unitCost: i.cost,
        balance: qty.get(k)!,
        refType: "compra",
        refId: id,
        userId: owner.id,
        createdAt: date,
      });
    }
  }

  // Compra inicial por proveedor, separada entre bodega y tienda.
  for (const sup of sups) {
    const mine = prods.filter((p) => supplierFor(p.category).id === sup.id);
    for (const [wh, share] of [
      [bodega.id, 0.6],
      [tienda.id, 0.4],
    ] as const) {
      buy(
        -92,
        wh,
        mine.map((p) => ({ p, q: Math.max(3, Math.round(between(18, 40) * share)), cost: baseCost.get(p.id)! })),
        sup.id,
      );
    }
  }

  let saleNo = 1000;
  const channelPick = [local, local, local, local, local, local, local, insta, insta, insta, insta, insta, insta, meli, meli, meli, meli, meli, web, web];
  // Productos que se dejan sin reponer al final, para mostrar alertas de stock bajo.
  const noRestock = new Set([prods[3].id, prods[10].id, prods[16].id, prods[25].id]);

  for (let offset = -90; offset <= 0; offset++) {
    // Reposición cada dos semanas, con alza de costo gradual.
    if (offset % 14 === 0 && offset < -3) {
      for (const sup of sups) {
        for (const wh of [bodega.id, tienda.id]) {
          const items = prods
            .filter((p) => supplierFor(p.category).id === sup.id)
            .filter((p) => (qty.get(key(p.id, wh)) ?? 0) < p.minStock * 1.6)
            .filter((p) => !(noRestock.has(p.id) && offset > -75))
            .map((p) => ({
              p,
              q: between(10, 24),
              cost: Math.round((baseCost.get(p.id)! * (1 + (90 + offset) / 90 * 0.06 + rand() * 0.03)) / 10) * 10,
            }));
          if (items.length) buy(offset, wh, items, sup.id);
        }
      }
    }

    const dow = new Date(at(offset, 720)).getUTCDay();
    const orders = dow === 0 ? between(1, 3) : dow === 6 ? between(5, 9) : between(3, 7);
    for (let o = 0; o < orders; o++) {
      const ch = pick(channelPick);
      const wh = ch.id === local.id ? tienda.id : bodega.id;
      const lines = new Map<string, number>();
      const nLines = rand() < 0.6 ? 1 : rand() < 0.8 ? 2 : 3;
      for (let l = 0; l < nLines; l++) {
        const p = pick(prods);
        const q = rand() < 0.8 ? 1 : 2;
        if ((qty.get(key(p.id, wh)) ?? 0) - (lines.get(p.id) ?? 0) >= q) lines.set(p.id, (lines.get(p.id) ?? 0) + q);
      }
      if (lines.size === 0) continue;
      const id = uuid();
      const date = at(offset, between(10 * 60, 20 * 60));
      if (date.getTime() > Date.now()) continue;
      let total = 0;
      let cogs = 0;
      for (const [pid, q] of lines) {
        const p = prods.find((x) => x.id === pid)!;
        const k = key(pid, wh);
        qty.set(k, qty.get(k)! - q);
        total += p.price * q;
        cogs += avg.get(pid)! * q;
        saleItemRows.push({ saleId: id, productId: pid, qty: q, unitPrice: p.price, unitCost: avg.get(pid)! });
        movementRows.push({
          orgId: org.id,
          productId: pid,
          warehouseId: wh,
          type: "sale",
          qty: -q,
          unitCost: avg.get(pid)!,
          balance: qty.get(k)!,
          refType: "venta",
          refId: id,
          userId: ch.id === local.id ? staff.id : owner.id,
          createdAt: date,
        });
      }
      const shipping =
        ch.id === insta.id && rand() < 0.4 ? 3500 : ch.id === meli.id && total >= 19990 ? 3900 : ch.id === web.id && rand() < 0.5 ? 2990 : 0;
      saleRows.push({
        id,
        orgId: org.id,
        number: saleNo++,
        channelId: ch.id,
        warehouseId: wh,
        customerName: ch.id === local.id ? null : pick(NAMES),
        externalRef: ch.id === meli.id ? `ML-${2000000000 + between(0, 99999999)}` : null,
        total,
        commission: Math.round((total * ch.commissionPct) / 100) + ch.fixedFee,
        shippingCost: shipping,
        cogs,
        status: "completed",
        date,
        userId: ch.id === local.id ? staff.id : owner.id,
        createdAt: date,
      });
    }
  }

  // Gastos mensuales de los últimos 3 meses + el actual.
  const expenseRows: Array<typeof s.expenses.$inferInsert> = [];
  const [ty, tm] = today.split("-").map(Number);
  for (let back = 3; back >= 0; back--) {
    const d = new Date(Date.UTC(ty, tm - 1 - back, 1));
    const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const items: Array<[number, string, string, number]> = [
      [5, "Arriendo", "Arriendo local Barrio Italia", 480000],
      [10, "Publicidad", "Campañas Meta (Instagram)", between(13, 17) * 10000],
      [12, "Packaging", "Bolsas, papel seda y cajas", between(35, 55) * 1000],
      [15, "Servicios básicos", "Luz, agua e internet", between(55, 70) * 1000],
      [20, "Contabilidad", "Contador mensual", 70000],
      [28, "Sueldos", "Sueldo vendedor part-time", 560000],
    ];
    for (const [day, category, description, amount] of items) {
      const date = localToUtc(`${ym}-${String(day).padStart(2, "0")}`, "12:00", TZ);
      if (date.getTime() > Date.now() || date < at(-92, 0)) continue;
      expenseRows.push({ orgId: org.id, date, category, description, amount, userId: owner.id, createdAt: date });
    }
  }

  await db.insert(s.purchases).values(purchaseRows);
  await db.insert(s.purchaseItems).values(purchaseItemRows);
  for (let i = 0; i < saleRows.length; i += 300) await db.insert(s.sales).values(saleRows.slice(i, i + 300));
  for (let i = 0; i < saleItemRows.length; i += 500) await db.insert(s.saleItems).values(saleItemRows.slice(i, i + 500));
  for (let i = 0; i < movementRows.length; i += 500) await db.insert(s.movements).values(movementRows.slice(i, i + 500));
  if (expenseRows.length) await db.insert(s.expenses).values(expenseRows);
  await db.insert(s.stock).values(
    [...qty.entries()].map(([k, q]) => {
      const [productId, warehouseId] = k.split(":");
      return { productId, warehouseId, qty: q };
    }),
  );
  for (const p of prods) await db.update(s.products).set({ avgCost: avg.get(p.id)! }).where(eq(s.products.id, p.id));
}
