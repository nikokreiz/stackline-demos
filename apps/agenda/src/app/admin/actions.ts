"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { logAudit } from "@stackline/core/audit";
import { PLANS, type Plan, organizations } from "@/db/schema";
import { requireSuperAdmin } from "@/lib/admin";

export async function extendTrialAction(orgId: string) {
  const { db, session } = await requireSuperAdmin();
  const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
  if (!org) return;
  const base = org.trialEndsAt && org.trialEndsAt > new Date() ? org.trialEndsAt : new Date();
  await db
    .update(organizations)
    .set({ plan: "trial", trialEndsAt: new Date(base.getTime() + 14 * 24 * 3600_000) })
    .where(eq(organizations.id, orgId));
  await logAudit(db, { orgId, userId: session.user.id, action: "admin_extiende_prueba", entity: "organizacion", entityId: orgId });
  revalidatePath("/admin");
}

export async function setPlanAction(orgId: string, form: FormData) {
  const { db, session } = await requireSuperAdmin();
  const plan = String(form.get("plan")) as Plan;
  if (!PLANS.includes(plan)) return;
  await db.update(organizations).set({ plan }).where(eq(organizations.id, orgId));
  await logAudit(db, { orgId, userId: session.user.id, action: "admin_cambia_plan", entity: "organizacion", entityId: orgId, data: { plan } });
  revalidatePath("/admin");
}

export async function setStatusAction(orgId: string, status: "active" | "suspended") {
  const { db, session } = await requireSuperAdmin();
  await db.update(organizations).set({ status }).where(eq(organizations.id, orgId));
  await logAudit(db, { orgId, userId: session.user.id, action: `admin_${status === "active" ? "activa" : "suspende"}`, entity: "organizacion", entityId: orgId });
  revalidatePath("/admin");
}
