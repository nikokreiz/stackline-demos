import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { clp, fmtDateTime, pct } from "@stackline/core/format";
import { Badge, Button, Card, CardHeader, PageHeader, Stat, Table, Td, Textarea, Th } from "@stackline/core/ui";
import { appointments, customers, professionals, services } from "@/db/schema";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/labels";
import { panel } from "@/lib/panel";
import { saveCustomerNotesAction } from "../../actions";

export const metadata = { title: "Cliente" };

export default async function ClienteDetalle({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, orgId, tz } = await panel();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [customer] = await db.select().from(customers).where(and(eq(customers.id, id), eq(customers.orgId, orgId)));
  if (!customer) notFound();

  const history = await db
    .select({ appt: appointments, serviceName: services.name, proName: professionals.name })
    .from(appointments)
    .innerJoin(services, eq(services.id, appointments.serviceId))
    .innerJoin(professionals, eq(professionals.id, appointments.professionalId))
    .where(eq(appointments.customerId, id))
    .orderBy(desc(appointments.startsAt));

  const done = history.filter((h) => h.appt.status === "completed");
  const noShow = history.filter((h) => h.appt.status === "no_show");
  const closed = done.length + noShow.length;
  const fav = Object.entries(
    done.reduce<Record<string, number>>((acc, h) => ({ ...acc, [h.proName]: (acc[h.proName] ?? 0) + 1 }), {}),
  ).sort((a, b) => b[1] - a[1])[0]?.[0];

  return (
    <>
      <Link href="/panel/clientes" className="mb-4 inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink">
        <ArrowLeft className="size-4" /> Clientes
      </Link>
      <PageHeader
        title={customer.name}
        description={`${customer.phone}${customer.email ? ` · ${customer.email}` : ""}${fav ? ` · Suele atenderse con ${fav}` : ""}`}
        actions={
          <a
            href={`https://wa.me/${customer.phone.replace(/\D/g, "")}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center rounded-lg border border-line bg-surface px-4 text-sm font-medium hover:bg-subtle"
          >
            Escribir por WhatsApp
          </a>
        }
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Visitas" value={done.length} />
        <Stat label="Total gastado" value={clp(done.reduce((s, h) => s + h.appt.price, 0))} />
        <Stat label="Tasa de inasistencia" value={pct(closed ? noShow.length / closed : 0)} hint={`${noShow.length} inasistencias`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Historial de citas" />
          <Table>
            <thead>
              <tr>
                <Th>Fecha</Th>
                <Th>Servicio</Th>
                <Th>Profesional</Th>
                <Th className="text-right">Valor</Th>
                <Th>Estado</Th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.appt.id} className="hover:bg-subtle">
                  <Td>
                    <Link href={`/panel/citas/${h.appt.id}`} className="hover:underline">
                      {fmtDateTime(h.appt.startsAt, tz)}
                    </Link>
                  </Td>
                  <Td>{h.serviceName}</Td>
                  <Td>{h.proName}</Td>
                  <Td className="text-right tabular-nums">{clp(h.appt.price)}</Td>
                  <Td>
                    <Badge tone={STATUS_TONE[h.appt.status]}>{STATUS_LABEL[h.appt.status]}</Badge>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
        <Card className="p-5">
          <form action={saveCustomerNotesAction.bind(null, customer.id)} className="space-y-3">
            <label htmlFor="notes" className="text-sm font-medium">
              Notas del cliente
            </label>
            <Textarea id="notes" name="notes" rows={6} defaultValue={customer.notes ?? ""} placeholder="Preferencias, alergias, tipo de corte…" />
            <Button variant="secondary" className="w-full">
              Guardar notas
            </Button>
          </form>
        </Card>
      </div>
    </>
  );
}
