import { eq } from "drizzle-orm";
import type { Db } from "@/db";
import { organizations } from "@/db/schema";

/** Palabras que no pueden usarse como enlace de un negocio. */
const RESERVED = new Set(["admin", "api", "panel", "login", "registro", "reservar", "cita", "invitacion", "pago-simulado", "stackline", "demo", "www"]);

export function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function isValidSlug(slug: string) {
  return /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/.test(slug) && !RESERVED.has(slug);
}

/** Devuelve un enlace libre basado en el nombre: barberia-sur, barberia-sur-2, … */
export async function uniqueSlug(db: Db, base: string) {
  let root = slugify(base) || "mi-negocio";
  if (root.length < 3 || RESERVED.has(root)) root = `${root}-agenda`.replace(/^-/, "");
  for (let i = 1; i < 50; i++) {
    const candidate = i === 1 ? root : `${root}-${i}`;
    const [taken] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.slug, candidate));
    if (!taken) return candidate;
  }
  return `${root}-${Date.now().toString(36)}`;
}

export async function slugAvailable(db: Db, slug: string, exceptOrgId?: string) {
  const [taken] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.slug, slug));
  return !taken || taken.id === exceptOrgId;
}
