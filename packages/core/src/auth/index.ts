import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { AppDb } from "../db";
import { memberships, organizations, sessions, users, type Role } from "../db/schema-core";
import { verifyPassword } from "./password";

export { hashPassword, verifyPassword } from "./password";

const COOKIE = "sl_session";
const SESSION_DAYS = 14;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = AppDb<any>;

export type Session = {
  user: { id: string; name: string; email: string };
  org: { id: string; name: string; slug: string; timezone: string };
  role: Role;
};

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Crea la sesión y deja la cookie. Llamar solo desde server actions o route handlers. */
export async function startSession(db: Db, userId: string, orgId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 3600 * 1000);
  await db.insert(sessions).values({ id: hashToken(token), userId, orgId, expiresAt });
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

/** Valida email y contraseña; devuelve el usuario y su primera empresa. */
export async function checkCredentials(db: Db, email: string, password: string) {
  const rows = await db
    .select({ user: users, orgId: memberships.orgId })
    .from(users)
    .innerJoin(memberships, eq(memberships.userId, users.id))
    .where(eq(users.email, email.trim().toLowerCase()))
    .limit(1);
  const row = rows[0];
  if (!row || !(await verifyPassword(password, row.user.passwordHash))) return null;
  return { userId: row.user.id, orgId: row.orgId };
}

export async function getSession(db: Db): Promise<Session | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const rows = await db
    .select({
      user: { id: users.id, name: users.name, email: users.email },
      org: {
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        timezone: organizations.timezone,
      },
      role: memberships.role,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .innerJoin(organizations, eq(organizations.id, sessions.orgId))
    .innerJoin(
      memberships,
      and(eq(memberships.userId, sessions.userId), eq(memberships.orgId, sessions.orgId)),
    )
    .where(and(eq(sessions.id, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return (rows[0] as Session | undefined) ?? null;
}

/** Para páginas del panel: redirige al login si no hay sesión válida. */
export async function requireSession(db: Db, loginPath = "/login"): Promise<Session> {
  const s = await getSession(db);
  if (!s) redirect(loginPath);
  return s;
}

/** Para acciones sensibles: exige uno de los roles indicados. */
export async function requireRole(db: Db, allowed: Role[], loginPath = "/login") {
  const s = await requireSession(db, loginPath);
  if (!allowed.includes(s.role)) throw new Error("No tienes permiso para esta acción.");
  return s;
}

/** Negocios a los que pertenece un usuario, para cambiar entre ellos. */
export async function listUserOrgs(db: Db, userId: string) {
  return db
    .select({ id: organizations.id, name: organizations.name, slug: organizations.slug, role: memberships.role })
    .from(memberships)
    .innerJoin(organizations, eq(organizations.id, memberships.orgId))
    .where(eq(memberships.userId, userId))
    .orderBy(organizations.name);
}

/** Cambia el negocio activo de la sesión actual, si el usuario pertenece a él. */
export async function switchSessionOrg(db: Db, orgId: string) {
  const s = await getSession(db);
  if (!s) return false;
  const [m] = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(and(eq(memberships.userId, s.user.id), eq(memberships.orgId, orgId)));
  if (!m) return false;
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return false;
  await db.update(sessions).set({ orgId }).where(eq(sessions.id, hashToken(token)));
  return true;
}

/**
 * Administradores de la plataforma (Stackline), por correo en SUPERADMIN_EMAILS.
 * En desarrollo, sin la variable, el dueño de la demo también lo es.
 */
export function isSuperAdmin(email: string) {
  const list = (process.env.SUPERADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (list.length === 0) return process.env.NODE_ENV !== "production" && email === "dueno@demo.cl";
  return list.includes(email.toLowerCase());
}

export async function endSession(db: Db) {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
  jar.delete(COOKIE);
}
