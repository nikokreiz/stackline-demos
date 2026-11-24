import Link from "next/link";
import { desc, sql } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { fmtDate, num } from "@stackline/core/format";
import { Badge, Button, Card, PageHeader, Stat, Table, Td, Th } from "@stackline/core/ui";
import { PLANS, appointments, memberships, organizations } from "@/db/schema";
import { requireSuperAdmin } from "@/lib/admin";
import { PLAN_LABEL, trialDaysLeft } from "@/lib/org";
import { industryLabel } from "@/lib/templates";
import { extendTrialAction, setPlanAction, setStatusAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Administración", robots: { index: false } };

export default async function AdminPage() {
  const { db } = await requireSuperAdmin();
  const monthAgo = new Date(Date.now() - 30 * 24 * 3600_000);
  const rows = await db
    .select({
      org: organizations,
      users: sql<number>`(select count(*) from ${memberships} where ${memberships.orgId} = ${organizations.id})`.mapWith(Number),
      appts30: sql<number>`(select count(*) from ${appointments} where ${appointments.orgId} = ${organizations.id} and ${appointments.createdAt} > ${monthAgo})`.mapWith(Number),
      lastActivity: sql<string | null>`(select max(${appointments.createdAt}) from ${appointments} where ${appointments.orgId} = ${organizations.id})`,
    })
    .from(organizations)
    .orderBy(desc(organizations.createdAt));

  const paying = rows.filter((r) => r.org.plan === "basico" || r.org.plan === "pro").length;
  const trials = rows.filter((r) => r.org.plan === "trial").length;
  const active = rows.filter((r) => r.appts30 > 0).length;

  return (
    <div className="min-h-dvh bg-canvas px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <Link href="/panel" className="mb-4 inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink">
          <ArrowLeft className="size-4" /> Volver al panel
        </Link>
        <PageHeader title="Stackline · Administración de Reservo" description="Todos los negocios registrados en la plataforma." />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Negocios" value={num(rows.length)} />
          <Stat label="Con reservas en 30 días" value={num(active)} />
          <Stat label="En prueba gratis" value={num(trials)} />
          <Stat label="Pagando" value={num(paying)} />
        </div>
        <Card className="mt-6">
          <Table>
            <thead>
              <tr>
                <Th>Negocio</Th>
                <Th>Rubro</Th>
                <Th>Plan</Th>
                <Th className="text-right">Usuarios</Th>
                <Th className="text-right">Reservas 30 d</Th>
                <Th>Última reserva</Th>
                <Th>Alta</Th>
                <Th>Acciones</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ org, users, appts30, lastActivity }) => {
                const days = trialDaysLeft(org);
                return (
                  <tr key={org.id} className={org.status === "suspended" ? "opacity-50" : ""}>
                    <Td>
                      <a href={`/reservar/${org.slug}`} target="_blank" className="font-medium hover:underline" rel="noreferrer">
                        {org.name}
                      </a>
                      <p className="text-xs text-ink-soft">/{org.slug}</p>
                    </Td>
                    <Td className="text-ink-soft">{industryLabel(org.industry)}</Td>
                    <Td>
                      <Badge tone={org.plan === "trial" ? (days !== null && days <= 0 ? "red" : "amber") : org.plan === "demo" ? "neutral" : "green"}>
                        {PLAN_LABEL[org.plan]}
                        {days !== null ? ` · ${days > 0 ? `${days} d` : "vencida"}` : ""}
                      </Badge>
                      {org.status === "suspended" && <Badge tone="red">Suspendido</Badge>}
                    </Td>
                    <Td className="text-right tabular-nums">{users}</Td>
                    <Td className="text-right tabular-nums">{appts30}</Td>
                    <Td className="text-ink-soft">{lastActivity ? fmtDate(lastActivity) : "—"}</Td>
                    <Td className="text-ink-soft">{fmtDate(org.createdAt)}</Td>
                    <Td>
                      <div className="flex flex-wrap items-center gap-1">
                        <form action={setPlanAction.bind(null, org.id)} className="flex gap-1">
                          <select name="plan" defaultValue={org.plan} className="h-8 rounded-md border border-line bg-surface px-2 text-xs">
                            {PLANS.map((p) => (
                              <option key={p} value={p}>{PLAN_LABEL[p]}</option>
                            ))}
                          </select>
                          <Button size="sm" variant="secondary">Guardar</Button>
                        </form>
                        <form action={extendTrialAction.bind(null, org.id)}>
                          <Button size="sm" variant="ghost">+14 días</Button>
                        </form>
                        <form action={setStatusAction.bind(null, org.id, org.status === "active" ? "suspended" : "active")}>
                          <Button size="sm" variant="ghost">{org.status === "active" ? "Suspender" : "Reactivar"}</Button>
                        </form>
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
