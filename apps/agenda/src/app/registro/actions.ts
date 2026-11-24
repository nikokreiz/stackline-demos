"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { logAudit } from "@stackline/core/audit";
import { getSession, hashPassword, startSession, verifyPassword } from "@stackline/core/auth";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { createBusiness } from "@/lib/onboarding";
import { INDUSTRIES } from "@/lib/templates";

export type SignupState = { error?: string; values?: Record<string, string> };

const schema = z.object({
  business: z.string().trim().min(3, "Escribe el nombre de tu negocio.").max(80),
  industry: z.string().refine((v) => v in INDUSTRIES, "Elige un rubro."),
  name: z.string().trim().min(2, "Escribe tu nombre.").max(80),
  email: z.email("El correo no es válido.").transform((v) => v.trim().toLowerCase()),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres.").max(200),
  terms: z.literal("on", { error: "Debes aceptar los términos para continuar." }),
});

export async function signupAction(_prev: SignupState, form: FormData): Promise<SignupState> {
  const raw = Object.fromEntries(form) as Record<string, string>;
  const values = { business: raw.business ?? "", industry: raw.industry ?? "", name: raw.name ?? "", email: raw.email ?? "" };
  const db = await getDb();
  const current = await getSession(db);

  // Usuario ya conectado creando otro negocio: no pide datos de cuenta.
  if (current && raw.mode === "nuevo") {
    const d = schema.pick({ business: true, industry: true }).safeParse(raw);
    if (!d.success) return { error: d.error.issues[0]?.message, values };
    const org = await createBusiness(db, { name: d.data.business, industry: d.data.industry, ownerUserId: current.user.id, ownerName: current.user.name });
    await logAudit(db, { orgId: org.id, userId: current.user.id, action: "crea_negocio", entity: "organizacion", entityId: org.id });
    await startSession(db, current.user.id, org.id);
    redirect("/panel?bienvenida=1");
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, values };
  const d = parsed.data;

  const [existing] = await db.select().from(users).where(eq(users.email, d.email));
  let userId: string;
  if (existing) {
    // Si ya tiene cuenta y la contraseña coincide, se le crea el negocio nuevo.
    if (!(await verifyPassword(d.password, existing.passwordHash))) {
      return { error: "Ya existe una cuenta con ese correo. Entra con tu contraseña o usa otro correo.", values };
    }
    userId = existing.id;
  } else {
    const [u] = await db.insert(users).values({ email: d.email, name: d.name, passwordHash: await hashPassword(d.password) }).returning();
    userId = u.id;
  }

  const org = await createBusiness(db, { name: d.business, industry: d.industry, ownerUserId: userId, ownerName: d.name });
  await logAudit(db, { orgId: org.id, userId, action: "registra_negocio", entity: "organizacion", entityId: org.id, data: { industry: d.industry } });
  await startSession(db, userId, org.id);
  redirect("/panel?bienvenida=1");
}
