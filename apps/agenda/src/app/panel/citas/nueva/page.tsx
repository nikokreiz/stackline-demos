import { and, asc, eq } from "drizzle-orm";
import { PageHeader } from "@stackline/core/ui";
import { isValidDateStr, todayLocal } from "@stackline/core/time";
import { professionals, services } from "@/db/schema";
import { panel } from "@/lib/panel";
import { NewAppointmentForm } from "./form";

export const metadata = { title: "Nueva cita" };

export default async function NuevaCita({ searchParams }: { searchParams: Promise<{ fecha?: string }> }) {
  const { db, orgId, tz } = await panel();
  const sp = await searchParams;
  const today = todayLocal(tz);
  const [svc, pros] = await Promise.all([
    db.select().from(services).where(and(eq(services.orgId, orgId), eq(services.active, true))).orderBy(asc(services.sort)),
    db.select().from(professionals).where(and(eq(professionals.orgId, orgId), eq(professionals.active, true))).orderBy(asc(professionals.name)),
  ]);
  const start = isValidDateStr(sp.fecha) && sp.fecha >= today ? sp.fecha : today;
  return (
    <>
      <PageHeader title="Nueva cita" description="Para reservas por teléfono, WhatsApp o en el local. No cobra abono." />
      <NewAppointmentForm
        today={start}
        services={svc.map((s) => ({ id: s.id, name: s.name, durationMin: s.durationMin, price: s.price }))}
        professionals={pros.map((p) => ({ id: p.id, name: p.name }))}
      />
    </>
  );
}
