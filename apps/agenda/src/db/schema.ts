import { relations } from "drizzle-orm";
import { boolean, index, integer, pgTable, smallint, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { organizations } from "@stackline/core/schema";

export * from "@stackline/core/schema";

const orgRef = () =>
  uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" });

const created = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const professionals = pgTable("professionals", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: orgRef(),
  name: text("name").notNull(),
  title: text("title"),
  color: text("color").notNull().default("#0f766e"),
  active: boolean("active").notNull().default(true),
  createdAt: created(),
});

export const services = pgTable("services", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: orgRef(),
  name: text("name").notNull(),
  description: text("description"),
  durationMin: integer("duration_min").notNull(),
  price: integer("price").notNull(),
  /** Abono que se cobra al reservar online. 0 = sin abono. */
  deposit: integer("deposit").notNull().default(0),
  active: boolean("active").notNull().default(true),
  sort: integer("sort").notNull().default(0),
  createdAt: created(),
});

/** Horario semanal de cada profesional (puede tener varios tramos por día). */
export const workingHours = pgTable(
  "working_hours",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: orgRef(),
    professionalId: uuid("professional_id")
      .notNull()
      .references(() => professionals.id, { onDelete: "cascade" }),
    weekday: smallint("weekday").notNull(), // 0 = domingo
    startMin: integer("start_min").notNull(),
    endMin: integer("end_min").notNull(),
  },
  (t) => [index("working_hours_pro").on(t.professionalId, t.weekday)],
);

/** Bloqueos puntuales: vacaciones, trámites, colación extendida. */
export const blocks = pgTable("blocks", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: orgRef(),
  professionalId: uuid("professional_id")
    .notNull()
    .references(() => professionals.id, { onDelete: "cascade" }),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  reason: text("reason"),
  createdAt: created(),
});

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: orgRef(),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    email: text("email"),
    notes: text("notes"),
    createdAt: created(),
  },
  (t) => [uniqueIndex("customers_org_phone").on(t.orgId, t.phone)],
);

export const APPOINTMENT_STATUS = ["pending_payment", "confirmed", "completed", "no_show", "cancelled"] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUS)[number];
export type DepositStatus = "none" | "pending" | "paid" | "refunded";

export const appointments = pgTable(
  "appointments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: orgRef(),
    professionalId: uuid("professional_id")
      .notNull()
      .references(() => professionals.id),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    status: text("status").$type<AppointmentStatus>().notNull().default("confirmed"),
    price: integer("price").notNull(),
    depositAmount: integer("deposit_amount").notNull().default(0),
    depositStatus: text("deposit_status").$type<DepositStatus>().notNull().default("none"),
    paymentRef: text("payment_ref"),
    /** Token secreto del enlace que recibe el cliente para confirmar, cancelar o cambiar la hora. */
    manageToken: text("manage_token").notNull().unique(),
    source: text("source").$type<"online" | "panel">().notNull().default("online"),
    notes: text("notes"),
    reminderSentAt: timestamp("reminder_sent_at", { withTimezone: true }),
    customerConfirmedAt: timestamp("customer_confirmed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: created(),
  },
  (t) => [
    index("appointments_org_start").on(t.orgId, t.startsAt),
    index("appointments_pro_start").on(t.professionalId, t.startsAt),
    index("appointments_customer").on(t.customerId),
  ],
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: orgRef(),
    appointmentId: uuid("appointment_id").references(() => appointments.id, { onDelete: "set null" }),
    kind: text("kind").$type<"confirmation" | "reminder" | "cancellation">().notNull(),
    channel: text("channel").$type<"whatsapp" | "email">().notNull(),
    to: text("to").notNull(),
    body: text("body").notNull(),
    status: text("status").$type<"sent" | "simulated" | "failed">().notNull(),
    error: text("error"),
    createdAt: created(),
  },
  (t) => [index("notifications_org_created").on(t.orgId, t.createdAt)],
);

export const appointmentsRelations = relations(appointments, ({ one }) => ({
  professional: one(professionals, { fields: [appointments.professionalId], references: [professionals.id] }),
  service: one(services, { fields: [appointments.serviceId], references: [services.id] }),
  customer: one(customers, { fields: [appointments.customerId], references: [customers.id] }),
}));

export type Professional = typeof professionals.$inferSelect;
export type Service = typeof services.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Appointment = typeof appointments.$inferSelect;
