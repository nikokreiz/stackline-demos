import { requireSession } from "@stackline/core/auth";
import { getDb } from "@/db";

/** Base de datos + sesión del panel. Redirige al login si no hay sesión. */
export async function panel() {
  const db = await getDb();
  const session = await requireSession(db, "/login");
  return { db, session, orgId: session.org.id, tz: session.org.timezone };
}

export const canManage = (role: string) => role === "owner" || role === "admin";
