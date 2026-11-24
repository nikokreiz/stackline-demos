import { asc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { clp } from "@stackline/core/format";
import { Button, Card, Field, Input, PageHeader } from "@stackline/core/ui";
import { channels } from "@/db/schema";
import { commissionFor } from "@/lib/inventory";
import { canManage, panel } from "@/lib/panel";
import { resetDemoAction, saveChannelAction } from "../actions";

export const metadata = { title: "Canales" };

export default async function CanalesPage() {
  const { db, orgId, session } = await panel();
  if (!canManage(session.role)) redirect("/panel/ventas");
  const rows = await db.select().from(channels).where(eq(channels.orgId, orgId)).orderBy(asc(channels.name));
  return (
    <>
      <PageHeader title="Canales de venta" description="Lo que cobra cada canal. Se aplica a las ventas nuevas; las anteriores mantienen su comisión." />
      <div className="grid gap-4 md:grid-cols-2">
        {rows.map((c) => (
          <Card key={c.id} className="p-5">
            <form action={saveChannelAction.bind(null, c.id)} className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="size-3 rounded-full" style={{ background: c.color }} />
                <Input name="name" defaultValue={c.name} className="h-9 font-medium" aria-label="Nombre del canal" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Comisión (%)"><Input name="commissionPct" type="number" step="0.01" min={0} max={100} defaultValue={c.commissionPct} /></Field>
                <Field label="Cargo fijo por venta"><Input name="fixedFee" type="number" min={0} step={10} defaultValue={c.fixedFee} /></Field>
              </div>
              <p className="text-xs text-ink-soft">
                En una venta de {clp(15000)} el canal se queda con {clp(commissionFor(c, 15000))}.
              </p>
              <Button variant="secondary" size="sm">Guardar</Button>
            </form>
          </Card>
        ))}
      </div>
      {session.role === "owner" && (
        <form action={resetDemoAction} className="mt-10 text-right">
          <button className="text-xs text-ink-faint underline hover:text-ink-soft cursor-pointer">Reiniciar datos de la demo</button>
        </form>
      )}
    </>
  );
}
