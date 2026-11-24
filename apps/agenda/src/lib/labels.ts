import type { AppointmentStatus, DepositStatus } from "@/db/schema";

export const STATUS_LABEL: Record<AppointmentStatus, string> = {
  pending_payment: "Esperando abono",
  confirmed: "Confirmada",
  completed: "Atendida",
  no_show: "No asistió",
  cancelled: "Cancelada",
};

export const STATUS_TONE: Record<AppointmentStatus, "amber" | "blue" | "green" | "red" | "neutral"> = {
  pending_payment: "amber",
  confirmed: "blue",
  completed: "green",
  no_show: "red",
  cancelled: "neutral",
};

export const DEPOSIT_LABEL: Record<DepositStatus, string> = {
  none: "Sin abono",
  pending: "Abono pendiente",
  paid: "Abono pagado",
  refunded: "Abono devuelto",
};

export const WEEKDAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
