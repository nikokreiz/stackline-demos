import { getDb } from "@/db";
import { getBaseUrl } from "@/lib/base-url";
import { isCronAuthorized } from "@/lib/cron-auth";
import { sendDueReminders } from "@/lib/reminders";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return new Response("No autorizado", { status: 401 });
  const sent = await sendDueReminders(await getDb(), await getBaseUrl());
  return Response.json({ sent });
}
