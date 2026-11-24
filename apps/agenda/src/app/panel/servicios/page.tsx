import { asc, eq } from "drizzle-orm";
import { clp } from "@stackline/core/format";
import { Badge, Button, Card, CardHeader, Field, Input, PageHeader } from "@stackline/core/ui";
import { services, type Service } from "@/db/schema";
import { canManage, panel } from "@/lib/panel";
import { saveServiceAction, toggleServiceAction } from "../actions";

export const metadata = { title: "Servicios" };

function ServiceFields({ s }: { s?: Service }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <div className="sm:col-span-2">
        <Field label="Nombre">
          <Input name="name" required defaultValue={s?.name} />
        </Field>
      </div>
      <Field label="Duración (min)">
        <Input name="durationMin" type="number" min={10} step={5} required defaultValue={s?.durationMin ?? 30} />
      </Field>
      <Field label="Precio">
        <Input name="price" type="number" min={0} step={500} required defaultValue={s?.price} />
      </Field>
      <Field label="Abono online">
        <Input name="deposit" type="number" min={0} step={500} defaultValue={s?.deposit ?? 0} />
      </Field>
      <div className="sm:col-span-2 lg:col-span-5">
        <Field label="Descripción">
          <Input name="description" defaultValue={s?.description ?? ""} />
        </Field>
      </div>
    </div>
  );
}

export default async function ServiciosPage() {
  const { db, orgId, session } = await panel();
  const editable = canManage(session.role);
  const rows = await db.select().from(services).where(eq(services.orgId, orgId)).orderBy(asc(services.sort), asc(services.name));

  return (
    <>
      <PageHeader title="Servicios" description="Lo que tus clientes pueden reservar online, con su duración, precio y abono." />
      <div className="space-y-3">
        {rows.map((s) => (
          <Card key={s.id} className={s.active ? "" : "opacity-60"}>
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4">
                <div>
                  <p className="font-medium">
                    {s.name} {!s.active && <Badge>Oculto</Badge>}
                  </p>
                  <p className="text-sm text-ink-soft">
                    {s.durationMin} min · {clp(s.price)} · {s.deposit > 0 ? `abono ${clp(s.deposit)}` : "sin abono"}
                  </p>
                </div>
                {editable && <span className="text-sm text-brand group-open:hidden">Editar</span>}
              </summary>
              {editable && (
                <div className="border-t border-line px-5 py-4">
                  <form action={saveServiceAction.bind(null, s.id)} className="space-y-3">
                    <ServiceFields s={s} />
                    <div className="flex gap-2">
                      <Button>Guardar</Button>
                    </div>
                  </form>
                  <form action={toggleServiceAction.bind(null, s.id, !s.active)} className="mt-2">
                    <Button variant="ghost" size="sm">
                      {s.active ? "Ocultar de la reserva online" : "Volver a mostrar"}
                    </Button>
                  </form>
                </div>
              )}
            </details>
          </Card>
        ))}
      </div>

      {editable && (
        <Card className="mt-6">
          <CardHeader title="Agregar servicio" />
          <form action={saveServiceAction.bind(null, null)} className="space-y-3 px-5 py-4">
            <ServiceFields />
            <Button>Agregar</Button>
          </form>
        </Card>
      )}
    </>
  );
}
