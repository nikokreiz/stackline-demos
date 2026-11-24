import { getDb } from "@/db";
import { resetDemo } from "@/db/seed";
import { isCronAuthorized } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";

/** Reinicia los datos de la demo pública (solo con DEMO_MODE=true). */
export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return new Response("No autorizado", { status: 401 });
  if (process.env.DEMO_MODE !== "true") return new Response("DEMO_MODE desactivado", { status: 403 });
  await resetDemo(await getDb());
  return Response.json({ ok: true });
}
