import { eq } from "drizzle-orm";
import type { Db } from "@/db";
import { organizations } from "@/db/schema";

export async function getOrg(db: Db, orgId: string) {
  const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
  return org;
}

/** Días que le quedan a la prueba gratis (null si no está en prueba). */
export function trialDaysLeft(org: { plan: string; trialEndsAt: Date | null }) {
  if (org.plan !== "trial" || !org.trialEndsAt) return null;
  return Math.ceil((org.trialEndsAt.getTime() - Date.now()) / (24 * 3600_000));
}

export const PLAN_LABEL: Record<string, string> = { demo: "Demo", trial: "Prueba gratis", basico: "Básico", pro: "Pro" };
