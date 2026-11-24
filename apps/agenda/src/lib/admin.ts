import { notFound } from "next/navigation";
import { getSession, isSuperAdmin } from "@stackline/core/auth";
import { getDb } from "@/db";

/** Solo administradores de Stackline (SUPERADMIN_EMAILS). Para el resto, la ruta no existe. */
export async function requireSuperAdmin() {
  const db = await getDb();
  const session = await getSession(db);
  if (!session || !isSuperAdmin(session.user.email)) notFound();
  return { db, session };
}
