import { and, eq, gt, isNull, lt } from "drizzle-orm";
import type { Db } from "@/db";
import { appointments } from "@/db/schema";
import { notifyAppointment } from "./notify";

/**
 * Envía el recordatorio a las citas confirmadas que ocurren entre 2 y 26
 * horas más, que aún no lo recibieron. Pensado para correr cada hora; si
 * corre una vez al día igual cubre el día siguiente.
 */
export async function sendDueReminders(db: Db, baseUrl: string, orgId?: string) {
  const now = Date.now();
  const due = await db
    .select({ id: appointments.id })
    .from(appointments)
    .where(
      and(
        eq(appointments.status, "confirmed"),
        isNull(appointments.reminderSentAt),
        gt(appointments.startsAt, new Date(now + 2 * 3600_000)),
        lt(appointments.startsAt, new Date(now + 26 * 3600_000)),
        orgId ? eq(appointments.orgId, orgId) : undefined,
      ),
    );
  for (const a of due) await notifyAppointment(db, a.id, "reminder", baseUrl);
  return due.length;
}
