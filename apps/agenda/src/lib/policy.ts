/** ¿Todavía se puede cancelar o cambiar? Respeta las horas mínimas que define el negocio. */
export function canChange(appt: { status: string; startsAt: Date }, cancellationHours: number) {
  return (
    (appt.status === "confirmed" || appt.status === "pending_payment") &&
    appt.startsAt.getTime() - Date.now() > cancellationHours * 3600_000
  );
}
