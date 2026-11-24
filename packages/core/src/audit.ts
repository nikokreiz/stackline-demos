import type { AppDb } from "./db";
import { auditLog } from "./db/schema-core";

/** Registra quién hizo qué. Toda acción que cambie datos del negocio debería pasar por aquí. */
export async function logAudit(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: AppDb<any>,
  entry: {
    orgId: string;
    userId?: string | null;
    action: string;
    entity: string;
    entityId?: string | null;
    data?: Record<string, unknown>;
  },
) {
  await db.insert(auditLog).values({
    orgId: entry.orgId,
    userId: entry.userId ?? null,
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId ?? null,
    data: entry.data ?? null,
  });
}
