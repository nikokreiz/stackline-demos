import Link from "next/link";
import { and, count, eq } from "drizzle-orm";
import { CheckCircle2, Circle } from "lucide-react";
import { Button, Card, CardHeader } from "@stackline/core/ui";
import type { Db } from "@/db";
import { appointments, services, workingHours, type OrgSettings } from "@/db/schema";
import { CopyLink } from "./copy-link";
import { finishOnboardingAction } from "@/app/panel/actions";

/** Guía de primeros pasos para un negocio recién registrado. */
export async function GettingStarted({
  db,
  org,
  baseUrl,
  welcome,
}: {
  db: Db;
  org: { id: string; slug: string; name: string; settings: OrgSettings };
  baseUrl: string;
  welcome: boolean;
}) {
  const [[svc], [hrs], [appts]] = await Promise.all([
    db.select({ n: count() }).from(services).where(and(eq(services.orgId, org.id), eq(services.active, true))),
    db.select({ n: count() }).from(workingHours).where(eq(workingHours.orgId, org.id)),
    db.select({ n: count() }).from(appointments).where(eq(appointments.orgId, org.id)),
  ]);
  const link = `${baseUrl}/reservar/${org.slug}`;
  const steps = [
    { done: svc.n > 0, title: "Revisa tus servicios, precios y abonos", text: "Partiste con servicios de ejemplo de tu rubro.", href: "/panel/servicios" },
    { done: hrs.n > 0, title: "Ajusta tu equipo y horarios", text: "Agrega a quienes atienden y sus horas de trabajo.", href: "/panel/equipo" },
    { done: !!(org.settings.whatsapp || org.settings.address), title: "Completa los datos de tu local", text: "Dirección, WhatsApp, color de marca y reglas de cancelación.", href: "/panel/ajustes" },
    { done: appts.n > 0, title: "Haz una reserva de prueba", text: "Abre tu enlace y reserva como si fueras cliente.", href: `/reservar/${org.slug}` },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <Card className="mb-6">
      <CardHeader
        title={welcome ? `¡Bienvenido a Reservo! Tu agenda “${org.name}” está creada.` : "Primeros pasos"}
        subtitle={`${doneCount} de ${steps.length} listos`}
        action={
          <form action={finishOnboardingAction}>
            <Button variant="ghost" size="sm">Ocultar guía</Button>
          </form>
        }
      />
      <div className="grid gap-6 px-5 py-4 lg:grid-cols-2">
        <ol className="space-y-3">
          {steps.map((s) => (
            <li key={s.title}>
              <Link href={s.href} className="flex gap-3 rounded-lg p-2 hover:bg-subtle">
                {s.done ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-brand" /> : <Circle className="mt-0.5 size-5 shrink-0 text-ink-faint" />}
                <span>
                  <span className={`block text-sm font-medium ${s.done ? "text-ink-soft line-through" : ""}`}>{s.title}</span>
                  <span className="block text-xs text-ink-soft">{s.text}</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
        <div className="rounded-xl bg-subtle p-4">
          <p className="text-sm font-medium">Tu enlace de reservas</p>
          <p className="mt-1 text-xs text-ink-soft">Ponlo en la bio de Instagram, en tu WhatsApp Business y en Google Maps.</p>
          <CopyLink url={link} />
        </div>
      </div>
    </Card>
  );
}
