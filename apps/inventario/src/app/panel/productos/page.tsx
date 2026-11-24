import Link from "next/link";
import { and, asc, eq, ilike, or, sql } from "drizzle-orm";
import { Download, Search, Upload } from "lucide-react";
import { clp, num, pct } from "@stackline/core/format";
import { Badge, Button, ButtonLink, Card, CardHeader, Field, Input, PageHeader, Select, Table, Td, Th } from "@stackline/core/ui";
import { products, stock, warehouses } from "@/db/schema";
import { canManage, panel } from "@/lib/panel";
import { saveProductAction } from "../actions";

export const metadata = { title: "Productos y stock" };

export default async function ProductosPage({ searchParams }: { searchParams: Promise<{ q?: string; cat?: string; bajo?: string }> }) {
  const { db, orgId, session } = await panel();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const whs = await db.select().from(warehouses).where(eq(warehouses.orgId, orgId)).orderBy(asc(warehouses.name));
  const perWh = whs.map((w) => sql<number>`coalesce(sum(${stock.qty}) filter (where ${stock.warehouseId} = ${w.id}), 0)`.mapWith(Number).as(`wh_${w.id.slice(0, 8)}`));
  const rows = await db
    .select({
      p: products,
      total: sql<number>`coalesce(sum(${stock.qty}), 0)`.mapWith(Number),
      ...Object.fromEntries(perWh.map((c, i) => [`w${i}`, c])),
    })
    .from(products)
    .leftJoin(stock, eq(stock.productId, products.id))
    .where(and(eq(products.orgId, orgId), q ? or(ilike(products.name, `%${q}%`), ilike(products.sku, `%${q}%`)) : undefined, sp.cat ? eq(products.category, sp.cat) : undefined))
    .groupBy(products.id)
    .orderBy(asc(products.sku));
  const cats = [...new Set((await db.select({ c: products.category }).from(products).where(eq(products.orgId, orgId))).map((r) => r.c))].sort();
  const list = sp.bajo ? rows.filter((r) => r.total <= r.p.minStock) : rows;
  const value = rows.reduce((t, r) => t + Math.max(0, r.total) * r.p.avgCost, 0);
  const editable = canManage(session.role);

  return (
    <>
      <PageHeader
        title="Productos y stock"
        description={`${rows.length} productos · inventario valorizado a costo: ${clp(value)}`}
        actions={
          <>
            <a href="/api/export/productos" className="inline-flex h-10 items-center gap-2 rounded-lg border border-line bg-surface px-4 text-sm font-medium hover:bg-subtle">
              <Download className="size-4" /> Exportar
            </a>
            {editable && (
              <ButtonLink href="/panel/productos/importar" variant="secondary">
                <Upload className="size-4" /> Importar planilla
              </ButtonLink>
            )}
          </>
        }
      />
      <Card>
        <form className="flex flex-wrap items-center gap-3 border-b border-line p-4">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
            <Input name="q" defaultValue={q} placeholder="Buscar por nombre o SKU" className="pl-9" />
          </div>
          <Select name="cat" defaultValue={sp.cat ?? ""} className="w-auto">
            <option value="">Todas las categorías</option>
            {cats.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="bajo" value="1" defaultChecked={!!sp.bajo} /> Solo stock bajo
          </label>
          <button className="h-10 rounded-lg border border-line px-4 text-sm hover:bg-subtle cursor-pointer">Filtrar</button>
        </form>
        <Table>
          <thead>
            <tr>
              <Th>Producto</Th>
              {whs.map((w) => (
                <Th key={w.id} className="text-right">{w.name}</Th>
              ))}
              <Th className="text-right">Total</Th>
              <Th className="text-right">Costo prom.</Th>
              <Th className="text-right">Precio</Th>
              <Th className="text-right">Margen bruto</Th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => {
              const row = r as unknown as Record<string, number>;
              const low = r.total <= r.p.minStock;
              const m = r.p.price ? (r.p.price - r.p.avgCost) / r.p.price : 0;
              return (
                <tr key={r.p.id} className={r.p.active ? "hover:bg-subtle" : "opacity-50"}>
                  <Td>
                    <Link href={`/panel/productos/${r.p.id}`} className="font-medium hover:underline">
                      {r.p.name}
                    </Link>
                    <p className="text-xs text-ink-soft">{r.p.sku} · {r.p.category}</p>
                  </Td>
                  {whs.map((w, i) => (
                    <Td key={w.id} className="text-right tabular-nums text-ink-soft">{num(row[`w${i}`])}</Td>
                  ))}
                  <Td className="text-right">
                    {low ? <Badge tone={r.total <= 0 ? "red" : "amber"}>{num(r.total)}</Badge> : <span className="tabular-nums">{num(r.total)}</span>}
                  </Td>
                  <Td className="text-right tabular-nums text-ink-soft">{clp(r.p.avgCost)}</Td>
                  <Td className="text-right tabular-nums">{clp(r.p.price)}</Td>
                  <Td className="text-right tabular-nums">{pct(m)}</Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>

      {editable && (
        <Card className="mt-6">
          <CardHeader title="Nuevo producto" subtitle="El stock se carga con una compra o un ajuste." />
          <form action={saveProductAction.bind(null, null)} className="grid gap-3 px-5 py-4 sm:grid-cols-3 lg:grid-cols-6">
            <Field label="SKU"><Input name="sku" required /></Field>
            <div className="sm:col-span-2"><Field label="Nombre"><Input name="name" required /></Field></div>
            <Field label="Categoría"><Input name="category" list="cats" /></Field>
            <datalist id="cats">{cats.map((c) => <option key={c} value={c} />)}</datalist>
            <Field label="Precio de venta"><Input name="price" type="number" min={0} required /></Field>
            <Field label="Stock mínimo"><Input name="minStock" type="number" min={0} defaultValue={3} /></Field>
            <Field label="Costo inicial"><Input name="cost" type="number" min={0} /></Field>
            <div className="flex items-end"><Button>Crear producto</Button></div>
          </form>
        </Card>
      )}
    </>
  );
}
