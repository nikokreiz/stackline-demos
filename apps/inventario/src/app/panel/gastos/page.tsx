import { and, desc, eq, gte, lt } from "drizzle-orm";
import { redirect } from "next/navigation";
import { Trash2 } from "lucide-react";
import { clp, fmtDate } from "@stackline/core/format";
import { BarList, Button, Card, CardHeader, Field, Input, PageHeader, Select, Table, Td, Th } from "@stackline/core/ui";
import { todayLocal } from "@stackline/core/time";
import { EXPENSE_CATEGORIES, expenses } from "@/db/schema";
import { isYm, monthRange } from "@/lib/metrics";
import { canManage, panel } from "@/lib/panel";
import { addExpenseAction, deleteExpenseAction } from "../actions";

export const metadata = { title: "Gastos" };

export default async function GastosPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { db, orgId, tz, session } = await panel();
  if (!canManage(session.role)) redirect("/panel/ventas");
  const sp = await searchParams;
  const ym = isYm(sp.mes) ? sp.mes : todayLocal(tz).slice(0, 7);
  const r = monthRange(ym, tz);
  const rows = await db
    .select()
    .from(expenses)
    .where(and(eq(expenses.orgId, orgId), gte(expenses.date, r.from), lt(expenses.date, r.to)))
    .orderBy(desc(expenses.date));
  const total = rows.reduce((t, e) => t + e.amount, 0);
  const byCat = Object.entries(rows.reduce<Record<string, number>>((a, e) => ({ ...a, [e.category]: (a[e.category] ?? 0) + e.amount }), {}))
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  return (
    <>
      <PageHeader
        title="Gastos"
        description={<span>{r.label} · total {clp(total)}</span>}
        actions={
          <form className="flex gap-2">
            <input type="month" name="mes" defaultValue={ym} className="h-10 rounded-lg border border-line bg-surface px-3 text-sm" />
            <button className="h-10 rounded-lg border border-line px-4 text-sm hover:bg-subtle cursor-pointer">Ver</button>
          </form>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <Table>
            <thead>
              <tr>
                <Th>Fecha</Th>
                <Th>Categoría</Th>
                <Th>Detalle</Th>
                <Th className="text-right">Monto</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id}>
                  <Td className="text-ink-soft">{fmtDate(e.date, tz)}</Td>
                  <Td>{e.category}</Td>
                  <Td className="text-ink-soft">{e.description ?? "—"}</Td>
                  <Td className="text-right tabular-nums">{clp(e.amount)}</Td>
                  <Td>
                    <form action={deleteExpenseAction.bind(null, e.id)}>
                      <button aria-label="Eliminar gasto" className="p-1 text-ink-faint hover:text-red-600 cursor-pointer"><Trash2 className="size-4" /></button>
                    </form>
                  </Td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><Td className="text-ink-soft">Sin gastos registrados este mes.</Td></tr>
              )}
            </tbody>
          </Table>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Registrar gasto" />
            <form action={addExpenseAction} className="grid gap-3 px-5 py-4">
              <Field label="Categoría">
                <Select name="category">{EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select>
              </Field>
              <Field label="Detalle"><Input name="description" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Monto"><Input name="amount" type="number" min={1} required /></Field>
                <Field label="Fecha"><Input name="date" type="date" defaultValue={todayLocal(tz)} required /></Field>
              </div>
              <Button>Agregar</Button>
            </form>
          </Card>
          <Card>
            <CardHeader title="Por categoría" />
            <BarList items={byCat} format={clp} />
          </Card>
        </div>
      </div>
    </>
  );
}
