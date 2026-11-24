"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { clp } from "@stackline/core/format";
import { Button, Card, CardHeader, Field, Input, Select } from "@stackline/core/ui";
import { createPurchaseAction } from "../../actions";

type Prod = { id: string; name: string; sku: string; avgCost: number };

export function PurchaseForm({ today, suppliers, warehouses, products }: { today: string; suppliers: Array<{ id: string; name: string }>; warehouses: Array<{ id: string; name: string }>; products: Prod[] }) {
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? "");
  const [warehouseId, setWarehouseId] = useState(warehouses.find((w) => w.name === "Bodega")?.id ?? warehouses[0]?.id);
  const [docNumber, setDocNumber] = useState("");
  const [date, setDate] = useState(today);
  const [lines, setLines] = useState([{ key: 1, productId: "", qty: 10, unit: 0 }]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const byId = new Map(products.map((p) => [p.id, p]));
  const valid = lines.filter((l) => l.productId && l.qty > 0);
  const total = valid.reduce((t, l) => t + l.qty * l.unit, 0);
  const update = (key: number, patch: Partial<(typeof lines)[number]>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  return (
    <div className="space-y-6">
      <Card className="grid gap-4 p-5 sm:grid-cols-4">
        <Field label="Proveedor">
          <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">Sin proveedor</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </Field>
        <Field label="Entra a">
          <Select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </Select>
        </Field>
        <Field label="N° factura"><Input value={docNumber} onChange={(e) => setDocNumber(e.target.value)} /></Field>
        <Field label="Fecha"><Input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} /></Field>
      </Card>
      <Card>
        <CardHeader title="Productos" subtitle="Costo unitario neto de la factura" />
        <div className="space-y-3 px-5 py-4">
          {lines.map((l) => {
            const p = byId.get(l.productId);
            return (
              <div key={l.key} className="grid grid-cols-12 items-center gap-2">
                <div className="col-span-12 sm:col-span-6">
                  <Select aria-label="Producto" value={l.productId} onChange={(e) => update(l.key, { productId: e.target.value, unit: Math.round(byId.get(e.target.value)?.avgCost ?? 0) })}>
                    <option value="">Elige un producto…</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.sku} · {p.name}</option>)}
                  </Select>
                </div>
                <div className="col-span-3 sm:col-span-2">
                  <Input aria-label="Cantidad" type="number" min={1} value={l.qty} onChange={(e) => update(l.key, { qty: Math.max(1, Number(e.target.value)) })} />
                </div>
                <div className="col-span-6 sm:col-span-3">
                  <Input aria-label="Costo unitario" type="number" min={0} step={10} value={l.unit} onChange={(e) => update(l.key, { unit: Math.max(0, Number(e.target.value)) })} />
                </div>
                <div className="col-span-3 flex justify-end sm:col-span-1">
                  <button type="button" aria-label="Quitar" onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((x) => x.key !== l.key) : ls))} className="p-2 text-ink-soft hover:text-red-600 cursor-pointer">
                    <Trash2 className="size-4" />
                  </button>
                </div>
                {p && l.unit > 0 && Math.abs(l.unit - p.avgCost) / (p.avgCost || 1) > 0.02 && (
                  <p className="col-span-12 -mt-1 text-xs text-ink-soft">
                    Costo promedio actual {clp(p.avgCost)} · este lote {l.unit > p.avgCost ? "sube" : "baja"} el costo
                  </p>
                )}
              </div>
            );
          })}
          <Button type="button" variant="ghost" size="sm" onClick={() => setLines((ls) => [...ls, { key: Date.now(), productId: "", qty: 10, unit: 0 }])}>
            <Plus className="size-4" /> Agregar producto
          </Button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line px-5 py-4">
          <p className="text-sm">Total compra: <span className="font-semibold tabular-nums">{clp(total)}</span></p>
          <div className="flex items-center gap-3">
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button
              disabled={pending || valid.length === 0}
              onClick={() =>
                start(async () => {
                  setError(null);
                  const res = await createPurchaseAction({ supplierId: supplierId || null, warehouseId, docNumber, date, lines: valid.map(({ productId, qty, unit }) => ({ productId, qty, unit })) });
                  if (res?.error) setError(res.error);
                })
              }
            >
              {pending ? "Guardando…" : "Registrar compra"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
