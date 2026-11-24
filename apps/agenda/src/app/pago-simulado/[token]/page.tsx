import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { CreditCard, ShieldCheck } from "lucide-react";
import { clp } from "@stackline/core/format";
import { Button, ButtonLink, Card } from "@stackline/core/ui";
import { getDb } from "@/db";
import { appointments, organizations, services } from "@/db/schema";
import { getBaseUrl } from "@/lib/base-url";
import { markDepositPaid, paymentsMode } from "@/lib/payments";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pago simulado", robots: { index: false } };

async function pay(token: string) {
  "use server";
  if (paymentsMode() !== "simulado") throw new Error("El pago simulado está desactivado.");
  const db = await getDb();
  const [appt] = await db.select().from(appointments).where(eq(appointments.manageToken, token));
  if (!appt) throw new Error("Cita no encontrada");
  await markDepositPaid(db, appt.id, `SIM-${randomBytes(4).toString("hex").toUpperCase()}`, await getBaseUrl());
  redirect(`/cita/${token}?nueva=1`);
}

/**
 * Pantalla que reemplaza a Mercado Pago cuando no hay credenciales, para que
 * la demo muestre el flujo completo sin cobrar nada.
 */
export default async function PagoSimulado({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (paymentsMode() !== "simulado") notFound();
  const db = await getDb();
  const [row] = await db
    .select({ appt: appointments, service: services, org: organizations })
    .from(appointments)
    .innerJoin(services, eq(services.id, appointments.serviceId))
    .innerJoin(organizations, eq(organizations.id, appointments.orgId))
    .where(eq(appointments.manageToken, token));
  if (!row) notFound();
  if (row.appt.status !== "pending_payment") redirect(`/cita/${token}`);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas px-4">
      <Card className="w-full max-w-sm p-6">
        <p className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
          Pasarela simulada · no se cobra nada
        </p>
        <h1 className="mt-4 text-lg font-semibold">Pagar abono</h1>
        <p className="text-sm text-ink-soft">
          {row.service.name} · {row.org.name}
        </p>
        <p className="mt-6 text-3xl font-semibold tabular-nums">{clp(row.appt.depositAmount)}</p>
        <div className="mt-6 rounded-lg border border-line p-3 text-sm text-ink-soft">
          <p className="flex items-center gap-2">
            <CreditCard className="size-4" /> Tarjeta de prueba •••• 4242
          </p>
        </div>
        <form action={pay.bind(null, token)} className="mt-6">
          <Button size="lg" className="w-full">
            Pagar {clp(row.appt.depositAmount)}
          </Button>
        </form>
        <ButtonLink href={`/cita/${token}`} variant="ghost" className="mt-2 w-full">
          Volver
        </ButtonLink>
        <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-ink-faint">
          <ShieldCheck className="size-3.5" /> En producción aquí se abre Mercado Pago
        </p>
      </Card>
    </div>
  );
}
