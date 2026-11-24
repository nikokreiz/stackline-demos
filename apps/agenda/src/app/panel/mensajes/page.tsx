import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { Send } from "lucide-react";
import { fmtDateTime } from "@stackline/core/format";
import { Badge, Button, Card, EmptyState, PageHeader, Table, Td, Th } from "@stackline/core/ui";
import { notifications } from "@/db/schema";
import { whatsappMode } from "@/lib/notify";
import { panel } from "@/lib/panel";
import { resetDemoAction, sendRemindersNowAction } from "../actions";

export const metadata = { title: "Mensajes" };

const KIND = { confirmation: "Confirmación", reminder: "Recordatorio", cancellation: "Cancelación" } as const;

export default async function MensajesPage() {
  const { db, orgId, tz, session } = await panel();
  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.orgId, orgId))
    .orderBy(desc(notifications.createdAt))
    .limit(100);
  const simulated = whatsappMode() === "simulado";

  return (
    <>
      <PageHeader
        title="Mensajes"
        description="Confirmaciones, recordatorios y avisos enviados por WhatsApp."
        actions={
          <form action={sendRemindersNowAction}>
            <Button>
              <Send className="size-4" /> Enviar recordatorios de mañana
            </Button>
          </form>
        }
      />
      {simulated && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Modo demo: los mensajes se registran aquí pero no se envían. Con las credenciales de WhatsApp Cloud API salen
          automáticamente cada hora, el día antes de cada cita.
        </div>
      )}
      <Card>
        {rows.length === 0 ? (
          <EmptyState
            title="Aún no hay mensajes"
            description="Haz una reserva desde la página pública o envía los recordatorios de mañana para ver cómo se ven."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Fecha</Th>
                <Th>Tipo</Th>
                <Th>Para</Th>
                <Th>Mensaje</Th>
                <Th>Estado</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id} className="align-top">
                  <Td className="whitespace-nowrap text-ink-soft">{fmtDateTime(m.createdAt, tz)}</Td>
                  <Td>{KIND[m.kind]}</Td>
                  <Td className="whitespace-nowrap">{m.to}</Td>
                  <Td className="min-w-72 max-w-xl">
                    {m.appointmentId ? (
                      <Link href={`/panel/citas/${m.appointmentId}`} className="hover:underline">
                        {m.body}
                      </Link>
                    ) : (
                      m.body
                    )}
                    {m.error && <p className="mt-1 text-xs text-red-600">{m.error}</p>}
                  </Td>
                  <Td>
                    <Badge tone={m.status === "failed" ? "red" : m.status === "sent" ? "green" : "neutral"}>
                      {m.status === "simulated" ? "Simulado" : m.status === "sent" ? "Enviado" : "Falló"}
                    </Badge>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {session.role === "owner" && (
        <form action={resetDemoAction} className="mt-10 text-right">
          <button className="text-xs text-ink-faint underline hover:text-ink-soft cursor-pointer">Reiniciar datos de la demo</button>
        </form>
      )}
    </>
  );
}
