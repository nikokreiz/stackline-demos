import type { Db } from "@/db";
import { memberships, organizations, professionals, services, workingHours } from "@/db/schema";
import { INDUSTRIES } from "./templates";
import { uniqueSlug } from "./slug";

export const TRIAL_DAYS = 14;

/**
 * Crea un negocio nuevo listo para recibir reservas: plantilla de servicios
 * del rubro, el dueño como primer profesional y un horario base de lunes a
 * sábado que después se ajusta.
 */
export async function createBusiness(
  db: Db,
  input: { name: string; industry: string; ownerUserId: string; ownerName: string },
) {
  const tpl = INDUSTRIES[input.industry] ?? INDUSTRIES.otro;
  const slug = await uniqueSlug(db, input.name);
  return db.transaction(async (tx) => {
    const [org] = await tx
      .insert(organizations)
      .values({
        name: input.name.trim(),
        slug,
        industry: input.industry in INDUSTRIES ? input.industry : "otro",
        plan: "trial",
        trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 24 * 3600_000),
        settings: { cancellationHours: 4 },
      })
      .returning();
    await tx.insert(memberships).values({ orgId: org.id, userId: input.ownerUserId, role: "owner" });
    await tx.insert(services).values(tpl.services.map((s, i) => ({ ...s, orgId: org.id, sort: i + 1 })));
    const [pro] = await tx
      .insert(professionals)
      .values({ orgId: org.id, name: input.ownerName.trim(), title: tpl.staffTitle })
      .returning();
    const hours: Array<typeof workingHours.$inferInsert> = [];
    for (let wd = 1; wd <= 5; wd++) hours.push({ orgId: org.id, professionalId: pro.id, weekday: wd, startMin: 600, endMin: 1140 });
    hours.push({ orgId: org.id, professionalId: pro.id, weekday: 6, startMin: 600, endMin: 840 });
    await tx.insert(workingHours).values(hours);
    return org;
  });
}
