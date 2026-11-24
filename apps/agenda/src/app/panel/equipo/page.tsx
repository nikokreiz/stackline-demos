import { and, asc, eq, gt, isNull } from "drizzle-orm";
import { Trash2 } from "lucide-react";
import { fmtDateTime } from "@stackline/core/format";
import { Badge, Button, Card, CardHeader, Field, Input, PageHeader, Select } from "@stackline/core/ui";
import { minutesToHHMM, todayLocal } from "@stackline/core/time";
import { blocks, invitations, memberships, professionals, users, workingHours } from "@/db/schema";
import { WEEKDAYS } from "@/lib/labels";
import { canManage, panel } from "@/lib/panel";
import { addBlockAction, addProfessionalAction, deleteBlockAction, removeMemberAction, revokeInvitationAction, saveHoursAction, toggleProfessionalAction } from "../actions";
import { InviteForm } from "./invite-form";

export const metadata = { title: "Equipo y horarios" };

const ORDER = [1, 2, 3, 4, 5, 6, 0];

export default async function EquipoPage() {
  const { db, orgId, tz, session } = await panel();
  const editable = canManage(session.role);
  const [pros, hours, blks, members, pending] = await Promise.all([
    db.select().from(professionals).where(eq(professionals.orgId, orgId)).orderBy(asc(professionals.name)),
    db.select().from(workingHours).where(eq(workingHours.orgId, orgId)).orderBy(asc(workingHours.startMin)),
    db
      .select({ block: blocks, proName: professionals.name })
      .from(blocks)
      .innerJoin(professionals, eq(professionals.id, blocks.professionalId))
      .where(and(eq(blocks.orgId, orgId), gt(blocks.endsAt, new Date())))
      .orderBy(asc(blocks.startsAt)),
    db
      .select({ id: memberships.id, role: memberships.role, userId: users.id, name: users.name, email: users.email })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(eq(memberships.orgId, orgId))
      .orderBy(asc(users.name)),
    db
      .select()
      .from(invitations)
      .where(and(eq(invitations.orgId, orgId), isNull(invitations.acceptedAt), gt(invitations.expiresAt, new Date()))),
  ]);
  const ROLE = { owner: "Dueño", admin: "Administrador", staff: "Recepción" } as const;

  const dayText = (proId: string, wd: number) =>
    hours
      .filter((h) => h.professionalId === proId && h.weekday === wd)
      .map((h) => `${minutesToHHMM(h.startMin)}-${minutesToHHMM(h.endMin)}`)
      .join(", ");

  return (
    <>
      <PageHeader title="Equipo y horarios" description="Horario semanal de cada profesional y bloqueos puntuales." />

      <div className="grid gap-6 xl:grid-cols-2">
        {pros.map((p) => (
          <Card key={p.id} className={p.active ? "" : "opacity-60"}>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <span className="size-3 rounded-full" style={{ background: p.color }} />
                  {p.name} {!p.active && <Badge>Inactivo</Badge>}
                </span>
              }
              subtitle={p.title ?? undefined}
              action={
                editable && (
                  <form action={toggleProfessionalAction.bind(null, p.id, !p.active)}>
                    <Button variant="ghost" size="sm">
                      {p.active ? "Desactivar" : "Activar"}
                    </Button>
                  </form>
                )
              }
            />
            <form action={saveHoursAction.bind(null, p.id)} className="px-5 py-4">
              <div className="space-y-2">
                {ORDER.map((wd) => (
                  <div key={wd} className="grid grid-cols-[6rem_1fr] items-center gap-3">
                    <label htmlFor={`${p.id}-d${wd}`} className="text-sm text-ink-soft">
                      {WEEKDAYS[wd]}
                    </label>
                    <Input
                      id={`${p.id}-d${wd}`}
                      name={`d${wd}`}
                      defaultValue={dayText(p.id, wd)}
                      placeholder="No trabaja"
                      disabled={!editable}
                      className="h-9"
                    />
                  </div>
                ))}
              </div>
              {editable && (
                <div className="mt-4 flex items-center justify-between gap-3">
                  <p className="text-xs text-ink-soft">Formato: 10:00-14:00, 15:00-20:00</p>
                  <Button variant="secondary" size="sm">
                    Guardar horario
                  </Button>
                </div>
              )}
            </form>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Bloqueos próximos" subtitle="Vacaciones, trámites o colaciones largas" />
          {blks.length === 0 ? (
            <p className="px-5 py-4 text-sm text-ink-soft">No hay bloqueos.</p>
          ) : (
            <ul className="divide-y divide-line">
              {blks.map(({ block, proName }) => (
                <li key={block.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <div>
                    <p className="font-medium">{proName}</p>
                    <p className="text-ink-soft">
                      {fmtDateTime(block.startsAt, tz)} → {fmtDateTime(block.endsAt, tz)}
                      {block.reason && ` · ${block.reason}`}
                    </p>
                  </div>
                  <form action={deleteBlockAction.bind(null, block.id)}>
                    <button aria-label="Eliminar bloqueo" className="p-1 text-ink-soft hover:text-red-600 cursor-pointer">
                      <Trash2 className="size-4" />
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          <form action={addBlockAction} className="grid gap-3 border-t border-line px-5 py-4 sm:grid-cols-2">
            <Field label="Profesional">
              <Select name="professionalId">
                {pros
                  .filter((p) => p.active)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </Select>
            </Field>
            <Field label="Fecha">
              <Input name="date" type="date" required defaultValue={todayLocal(tz)} />
            </Field>
            <Field label="Desde">
              <Input name="start" type="time" required defaultValue="13:00" />
            </Field>
            <Field label="Hasta">
              <Input name="end" type="time" required defaultValue="15:00" />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Motivo (opcional)">
                <Input name="reason" />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Button variant="secondary">Agregar bloqueo</Button>
            </div>
          </form>
        </Card>

        {editable && (
          <Card>
            <CardHeader title="Agregar profesional" />
            <form action={addProfessionalAction} className="grid gap-3 px-5 py-4 sm:grid-cols-2">
              <Field label="Nombre">
                <Input name="name" required />
              </Field>
              <Field label="Cargo">
                <Input name="title" placeholder="Barbero, estilista…" />
              </Field>
              <Field label="Color en la agenda">
                <Input name="color" type="color" defaultValue="#be185d" className="h-10 p-1" />
              </Field>
              <div className="flex items-end">
                <Button>Agregar</Button>
              </div>
              <p className="text-xs text-ink-soft sm:col-span-2">Después de agregarlo, define su horario para que aparezca en la reserva online.</p>
            </form>
          </Card>
        )}
      </div>
      <Card className="mt-6">
        <CardHeader title="Usuarios con acceso al panel" subtitle="Quiénes pueden entrar a la agenda de este negocio." />
        <ul className="divide-y divide-line">
          {members.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
              <span className="min-w-0">
                <span className="block font-medium">{m.name}</span>
                <span className="block truncate text-xs text-ink-soft">{m.email}</span>
              </span>
              <span className="flex items-center gap-2">
                <Badge tone={m.role === "owner" ? "brand" : "neutral"}>{ROLE[m.role]}</Badge>
                {editable && m.userId !== session.user.id && (
                  <form action={removeMemberAction.bind(null, m.id)}>
                    <Button variant="ghost" size="sm">Quitar</Button>
                  </form>
                )}
              </span>
            </li>
          ))}
          {pending.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
              <span className="min-w-0">
                <span className="block truncate text-ink-soft">{i.email}</span>
                <span className="text-xs text-ink-faint">Invitación pendiente · vence {fmtDateTime(i.expiresAt, tz)}</span>
              </span>
              {editable && (
                <form action={revokeInvitationAction.bind(null, i.id)}>
                  <Button variant="ghost" size="sm">Revocar</Button>
                </form>
              )}
            </li>
          ))}
        </ul>
        {editable && <InviteForm />}
      </Card>
    </>
  );
}
