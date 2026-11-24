"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { clp, pct } from "@stackline/core/format";
import { Button, Card, CardHeader, Field, Input, Select, cn } from "@stackline/core/ui";
import { createSaleAction, stockForWarehouseAction } from "../../actions";

type Ch = { id: string; name: string; kind: string; commissionPct: number; fixedFee: number };
type Prod = { id: string; name: string; sku: string; price: number; avgCost: number };
type LineState = { key: number; productId: string; qty: number; unit: number };

export function SaleForm({ today, channels, warehouses, products }: { today: string; channels: Ch[]; warehouses: Array<{ id: string; name: string }>; products: Prod[] }) {
  const tienda = warehouses.find((w) => w.name.toLowerCase().includes("tienda"));
  const bodega = warehouses.find((w) => w.id !== tienda?.id) ?? warehouses[0];
  const [channelId, setChannelId] = useState(channels[0]?.id ?? "");
  const channel = channels.find((c) => c.id === channelId);
  const [warehouseId, setWarehouseId] = useState((channel?.kind === "local" ? tienda : bodega)?.id ?? warehouses[0]?.id);
  const [date, setDate] = useState(today);
  const [customerName, setCustomerName] = useState("");
  const [externalRef, setExternalRef] = useState("");
  const [shipping, setShipping] = useState(0);
  const [lines, setLines] = useState<LineState[]>([{ key: 1, productId: "", qty: 1, unit: 0 }]);
  const [stock, setStock] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (warehouseId) stockForWarehouseAction(warehouseId).then(setStock);
  }, [warehouseId]);

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const valid = lines.filter((l) => l.productId && l.qty > 0);
  const total = valid.reduce((t, l) => t + l.qty * l.unit, 0);
  const cogs = valid.reduce((t, l) => t + l.qty * (byId.get(l.productId)?.avgCost ?? 0), 0);
  const commission = channel && total > 0 ? Math.round((total * channel.commissionPct) / 100) + channel.fixedFee : 0;
  const margin = total - cogs - commission - shipping;

  const update = (key: number, patch: Partial<LineState>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card className="p-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Canal">
              <Select
                value={channelId}
                onChange={(e) => {
                  setChannelId(e.target.value);
                  const ch = channels.find((c) => c.id === e.target.value);
                  setWarehouseId((ch?.kind === "local" ? tienda : bodega)?.id ?? warehouseId);
                }}
              >
                {channels.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Sale de">
              <Select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Fecha">
              <Input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
            </Field>
            {channel?.kind !== "local" && (
              <>
                <Field label="Cliente (opcional)">
                  <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
                </Field>
                <Field label={channel?.kind === "mercadolibre" ? "N° de venta ML" : "Referencia"}>
                  <Input value={externalRef} onChange={(e) => setExternalRef(e.target.value)} />
                </Field>
                <Field label="Envío que pagas tú">
                  <Input type="number" min={0} step={100} value={shipping || ""} onChange={(e) => setShipping(Math.max(0, Number(e.target.value)))} />
                </Field>
              </>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Productos" />
          <div className="space-y-3 px-5 py-4">
            {lines.map((l) => {
              const available = l.productId ? stock[l.productId] ?? 0 : null;
              const short = available !== null && l.qty > available;
              return (
                <div key={l.key} className="grid grid-cols-12 items-end gap-2">
                  <div className="col-span-12 sm:col-span-6">
                    <Select
                      aria-label="Producto"
                      value={l.productId}
                      onChange={(e) => update(l.key, { productId: e.target.value, unit: byId.get(e.target.value)?.price ?? 0 })}
                    >
                      <option value="">Elige un producto…</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.sku} · {p.name} ({stock[p.id] ?? 0} disp.)
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="col-span-3 sm:col-span-2">
                    <Input aria-label="Cantidad" type="number" min={1} value={l.qty} onChange={(e) => update(l.key, { qty: Math.max(1, Number(e.target.value)) })} className={cn(short && "border-red-500")} />
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <Input aria-label="Precio unitario" type="number" min={0} step={10} value={l.unit} onChange={(e) => update(l.key, { unit: Math.max(0, Number(e.target.value)) })} />
                  </div>
                  <div className="col-span-3 flex justify-end sm:col-span-1">
                    <button type="button" aria-label="Quitar" onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((x) => x.key !== l.key) : ls))} className="p-2 text-ink-soft hover:text-red-600 cursor-pointer">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  {short && <p className="col-span-12 -mt-1 text-xs text-red-600">Solo hay {available} en esta bodega.</p>}
                </div>
              );
            })}
            <Button type="button" variant="ghost" size="sm" onClick={() => setLines((ls) => [...ls, { key: Date.now(), productId: "", qty: 1, unit: 0 }])}>
              <Plus className="size-4" /> Agregar producto
            </Button>
          </div>
        </Card>
      </div>

      <Card className="h-fit p-5 lg:sticky lg:top-6">
        <p className="font-semibold">Resultado de esta venta</p>
        <dl className="mt-4 space-y-2 text-sm">
          <Row label="Total cobrado" value={clp(total)} strong />
          <Row label="Costo de la mercadería" value={`− ${clp(cogs)}`} />
          <Row label={`Comisión ${channel?.name ?? ""}${channel ? ` (${channel.commissionPct}%${channel.fixedFee ? ` + ${clp(channel.fixedFee)}` : ""})` : ""}`} value={`− ${clp(commission)}`} />
          {shipping > 0 && <Row label="Envío" value={`− ${clp(shipping)}`} />}
          <div className="border-t border-line pt-2">
            <Row label="Te queda" value={<span className={margin >= 0 ? "text-emerald-600" : "text-red-600"}>{clp(margin)}</span>} strong />
            <p className="mt-1 text-right text-xs text-ink-soft">{total ? `${pct(margin / total)} de margen` : ""}</p>
          </div>
        </dl>
        {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <Button
          className="mt-5 w-full"
          size="lg"
          disabled={pending || valid.length === 0}
          onClick={() => {
            setError(null);
            start(async () => {
              const res = await createSaleAction({
                channelId,
                warehouseId,
                date,
                customerName,
                externalRef,
                shippingCost: shipping,
                lines: valid.map((l) => ({ productId: l.productId, qty: l.qty, unit: l.unit })),
              });
              if (res?.error) setError(res.error);
            });
          }}
        >
          {pending ? "Guardando…" : "Registrar venta"}
        </Button>
      </Card>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className={cn("flex justify-between gap-3", strong ? "font-semibold text-ink" : "text-ink-soft")}>
      <dt>{label}</dt>
      <dd className="whitespace-nowrap tabular-nums">{value}</dd>
    </div>
  );
}
