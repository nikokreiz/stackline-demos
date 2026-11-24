import { and, asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { MapPin } from "lucide-react";
import { DemoBanner } from "@stackline/core/ui";
import { todayLocal } from "@stackline/core/time";
import { getDb } from "@/db";
import { organizations, professionals, services } from "@/db/schema";
import { BOOKING_WINDOW_DAYS } from "@/lib/slots";
import { paymentsMode } from "@/lib/payments";
import { brandStyle } from "@/lib/brand";
import { BookingFlow } from "./booking-flow";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = await getDb();
  const [org] = await db.select().from(organizations).where(eq(organizations.slug, slug));
  return { title: org ? `Reserva tu hora en ${org.name}` : "Reservar" };
}

export default async function ReservarPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = await getDb();
  const [org] = await db.select().from(organizations).where(eq(organizations.slug, slug));
  if (!org || org.status !== "active") notFound();

  const [svc, pros] = await Promise.all([
    db
      .select()
      .from(services)
      .where(and(eq(services.orgId, org.id), eq(services.active, true)))
      .orderBy(asc(services.sort), asc(services.name)),
    db
      .select({ id: professionals.id, name: professionals.name, title: professionals.title, color: professionals.color })
      .from(professionals)
      .where(and(eq(professionals.orgId, org.id), eq(professionals.active, true)))
      .orderBy(asc(professionals.name)),
  ]);

  return (
    <div className="min-h-dvh bg-canvas" style={brandStyle(org.settings.brandColor)}>
      {paymentsMode() === "simulado" && <DemoBanner>Demo: el pago del abono es simulado y no se cobra nada.</DemoBanner>}
      <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">{org.name}</h1>
          {org.settings.description && <p className="mt-1 text-ink-soft">{org.settings.description}</p>}
          {org.settings.address && (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-soft">
              <MapPin className="size-4" /> {org.settings.address}
            </p>
          )}
        </header>
        <BookingFlow
          slug={org.slug}
          today={todayLocal(org.timezone)}
          days={BOOKING_WINDOW_DAYS}
          services={svc.map((s) => ({
            id: s.id,
            name: s.name,
            description: s.description,
            durationMin: s.durationMin,
            price: s.price,
            deposit: s.deposit,
          }))}
          professionals={pros}
        />
        <p className="mt-10 text-center text-xs text-ink-faint">Agenda creada por Stackline · stacklines.vercel.app</p>
      </div>
    </div>
  );
}
