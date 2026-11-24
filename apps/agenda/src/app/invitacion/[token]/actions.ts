"use server";

import { and, eq, gt, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { logAudit } from "@stackline/core/audit";
import { hashPassword, hashToken, startSession, verifyPassword } from "@stackline/core/auth";
import { getDb } from "@/db";
import { invitations, memberships, users } from "@/db/schema";

export type AcceptState = { error?: string };

export async function acceptInvitationAction(token: string, _prev: AcceptState, form: FormData): Promise<AcceptState> {
  const db = await getDb();
  const [inv] = await db
    .select()
    .from(invitations)
    .where(and(eq(invitations.tokenHash, hashToken(token)), isNull(invitations.acceptedAt), gt(invitations.expiresAt, new Date())));
  if (!inv) return { error: "La invitación ya no es válida." };
  const password = String(form.get("password") ?? "");
  const name = String(form.get("name") ?? "").trim();

  let [user] = await db.select().from(users).where(eq(users.email, inv.email));
  if (user) {
    if (!(await verifyPassword(password, user.passwordHash))) return { error: "La contraseña no coincide con tu cuenta." };
  } else {
    if (name.length < 2) return { error: "Escribe tu nombre." };
    if (password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres." };
    [user] = await db.insert(users).values({ email: inv.email, name, passwordHash: await hashPassword(password) }).returning();
  }

  await db.insert(memberships).values({ orgId: inv.orgId, userId: user.id, role: inv.role }).onConflictDoNothing();
  await db.update(invitations).set({ acceptedAt: new Date() }).where(eq(invitations.id, inv.id));
  await logAudit(db, { orgId: inv.orgId, userId: user.id, action: "acepta_invitacion", entity: "usuario", entityId: user.id });
  await startSession(db, user.id, inv.orgId);
  redirect("/panel");
}
