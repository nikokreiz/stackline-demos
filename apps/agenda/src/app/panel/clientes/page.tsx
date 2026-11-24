import Link from "next/link";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { Search } from "lucide-react";
import { clp, fmtDate } from "@stackline/core/format";
import { Badge, Card, EmptyState, Input, PageHeader, Table, Td, Th } from "@stackline/core/ui";
import { appointments, customers } from "@/db/schema";
import { panel } from "@/lib/panel";

export const metadata = { title: "Clientes" };

export default async function ClientesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { db, orgId, tz } = await panel();
  const q = ((await searchParams).q ?? "").trim();
  const now = new Date();

  const rows = await db
    .select({
      id: customers.id,
      name: customers.name,
      phone: customers.phone,
      visits: sql<number>`count(${appointments.id}) filter (where ${appointments.status} = 'completed')`.mapWith(Number),
      noShows: sql<number>`count(${appointments.id}) filter (where ${appointments.status} = 'no_show')`.mapWith(Number),
      spent: sql<number>`coalesce(sum(${appointments.price}) filter (where ${appointments.status} = 'completed'), 0)`.mapWith(Number),
      lastVisit: sql<Date | null>`max(${appointments.startsAt}) filter (where ${appointments.status} = 'completed')`.mapWith(
        (v) => (v ? new Date(v) : null),
      ),
      nextVisit: sql<Date | null>`min(${appointments.startsAt}) filter (where ${appointments.status} in ('confirmed','pending_payment') and ${appointments.startsAt} > ${now})`.mapWith(
        (v) => (v ? new Date(v) : null),
      ),
    })
    .from(customers)
    .leftJoin(appointments, eq(appointments.customerId, customers.id))
    .where(and(eq(customers.orgId, orgId), q ? or(ilike(customers.name, `%${q}%`), ilike(customers.phone, `%${q}%`)) : undefined))
    .groupBy(customers.id)
    .orderBy(desc(sql`max(${appointments.startsAt})`))
    .limit(200);

  return (
    <>
      <PageHeader title="Clientes" description={`${rows.length} clientes${q ? ` que coinciden con “${q}”` : ""}`} />
      <Card>
        <form className="border-b border-line p-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
            <Input name="q" defaultValue={q} placeholder="Buscar por nombre o teléfono" className="pl-9" />
          </div>
        </form>
        {rows.length === 0 ? (
          <EmptyState title="Sin resultados" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Cliente</Th>
                <Th className="text-right">Visitas</Th>
                <Th className="text-right">Inasistencias</Th>
                <Th className="text-right">Total gastado</Th>
                <Th>Última visita</Th>
                <Th>Próxima cita</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="hover:bg-subtle">
                  <Td>
                    <Link href={`/panel/clientes/${c.id}`} className="font-medium hover:underline">
                      {c.name}
                    </Link>
                    <p className="text-xs text-ink-soft">{c.phone}</p>
                  </Td>
                  <Td className="text-right tabular-nums">{c.visits}</Td>
                  <Td className="text-right">{c.noShows > 0 ? <Badge tone="red">{c.noShows}</Badge> : <span className="text-ink-faint">0</span>}</Td>
                  <Td className="text-right tabular-nums">{clp(c.spent)}</Td>
                  <Td className="text-ink-soft">{c.lastVisit ? fmtDate(c.lastVisit, tz) : "—"}</Td>
                  <Td>{c.nextVisit ? fmtDate(c.nextVisit, tz) : <span className="text-ink-faint">—</span>}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
