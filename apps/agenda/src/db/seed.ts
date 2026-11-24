import { randomBytes } from "node:crypto";
import { count, eq, inArray } from "drizzle-orm";
import { hashPassword } from "@stackline/core/auth";
import type { AppDb } from "@stackline/core/db";
import { addDaysStr, localToUtc, minutesToHHMM, todayLocal, weekdayOf } from "@stackline/core/time";
import * as s from "./schema";

type Db = AppDb<typeof s>;

export const DEMO_SLUG = "el-roble";
export const DEMO_USERS = {
  owner: { email: "dueno@demo.cl", password: "demo1234", name: "Rodrigo Pizarro" },
  staff: { email: "recepcion@demo.cl", password: "demo1234", name: "Javiera Muñoz" },
};

const TZ = "America/Santiago";

/** Generador pseudoaleatorio con semilla, para que la demo sea siempre parecida. */
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

export const newToken = () => randomBytes(18).toString("base64url");

export async function seedIfEmpty(db: Db) {
  const [{ n }] = await db.select({ n: count() }).from(s.organizations);
  if (n === 0) await seedDemo(db);
}

/** Borra la empresa demo y la vuelve a crear con fechas relativas a hoy. */
export async function resetDemo(db: Db) {
  await db.delete(s.organizations).where(eq(s.organizations.slug, DEMO_SLUG));
  await db.delete(s.users).where(inArray(s.users.email, [DEMO_USERS.owner.email, DEMO_USERS.staff.email]));
  await seedDemo(db);
}

const FIRST = [
  "Benjamín", "Vicente", "Martín", "Matías", "Joaquín", "Agustín", "Tomás", "Cristóbal", "Maximiliano", "Sebastián",
  "Felipe", "Ignacio", "Nicolás", "Lucas", "Gaspar", "Diego", "Francisco", "José", "Sofía", "Isidora", "Florencia",
  "Antonia", "Catalina", "Fernanda", "Valentina", "Josefa", "Martina", "Trinidad", "Emilia", "Constanza",
];
const LAST = [
  "González", "Muñoz", "Rojas", "Díaz", "Pérez", "Soto", "Contreras", "Silva", "Martínez", "Sepúlveda", "Morales",
  "Rodríguez", "López", "Fuentes", "Hernández", "Torres", "Araya", "Flores", "Espinoza", "Valenzuela", "Castillo",
  "Tapia", "Reyes", "Gutiérrez", "Castro", "Pizarro", "Álvarez", "Vásquez", "Sánchez", "Fernández",
];

async function seedDemo(db: Db) {
  const rand = rng(20261124);
  const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)];

  const [org] = await db
    .insert(s.organizations)
    .values({
      slug: DEMO_SLUG,
      name: "Barbería El Roble",
      timezone: TZ,
      settings: {
        address: "Av. Italia 1450, Providencia, Santiago",
        phone: "+56 9 5555 1234",
        whatsapp: "+56955551234",
        instagram: "@barberiaelroble",
        cancellationHours: 4,
      },
    })
    .returning();

  const [owner, staff] = await db
    .insert(s.users)
    .values([
      { email: DEMO_USERS.owner.email, name: DEMO_USERS.owner.name, passwordHash: await hashPassword(DEMO_USERS.owner.password) },
      { email: DEMO_USERS.staff.email, name: DEMO_USERS.staff.name, passwordHash: await hashPassword(DEMO_USERS.staff.password) },
    ])
    .returning();
  await db.insert(s.memberships).values([
    { orgId: org.id, userId: owner.id, role: "owner" },
    { orgId: org.id, userId: staff.id, role: "staff" },
  ]);

  const pros = await db
    .insert(s.professionals)
    .values([
      { orgId: org.id, name: "Matías Rojas", title: "Barbero senior", color: "#0f766e" },
      { orgId: org.id, name: "Camila Soto", title: "Estilista y colorista", color: "#b45309" },
      { orgId: org.id, name: "Diego Fuentes", title: "Barbero", color: "#4338ca" },
    ])
    .returning();

  const svc = await db
    .insert(s.services)
    .values([
      { orgId: org.id, sort: 1, name: "Corte clásico", description: "Corte a tijera o máquina, lavado incluido.", durationMin: 30, price: 12000, deposit: 3000 },
      { orgId: org.id, sort: 2, name: "Corte + barba", description: "Corte completo y perfilado de barba con toalla caliente.", durationMin: 60, price: 18000, deposit: 5000 },
      { orgId: org.id, sort: 3, name: "Perfilado de barba", description: "Diseño y perfilado con navaja.", durationMin: 30, price: 8000, deposit: 2000 },
      { orgId: org.id, sort: 4, name: "Corte niño", description: "Hasta 12 años.", durationMin: 30, price: 9000, deposit: 2000 },
      { orgId: org.id, sort: 5, name: "Color o decoloración", description: "Incluye diagnóstico y matización.", durationMin: 90, price: 35000, deposit: 10000 },
      { orgId: org.id, sort: 6, name: "Lavado y peinado", description: "Sin abono.", durationMin: 30, price: 7000, deposit: 0 },
    ])
    .returning();

  // Horario: lunes a viernes 10–14 y 15–20, sábado 10–15. Diego no trabaja los lunes.
  const hours: Array<typeof s.workingHours.$inferInsert> = [];
  for (const p of pros) {
    for (let wd = 1; wd <= 6; wd++) {
      if (p.name.startsWith("Diego") && wd === 1) continue;
      if (wd === 6) hours.push({ orgId: org.id, professionalId: p.id, weekday: wd, startMin: 600, endMin: 900 });
      else {
        hours.push({ orgId: org.id, professionalId: p.id, weekday: wd, startMin: 600, endMin: 840 });
        hours.push({ orgId: org.id, professionalId: p.id, weekday: wd, startMin: 900, endMin: 1200 });
      }
    }
  }
  await db.insert(s.workingHours).values(hours);

  // Clientes
  const used = new Set<string>();
  const customerRows: Array<typeof s.customers.$inferInsert> = [];
  while (customerRows.length < 48) {
    const name = `${pick(FIRST)} ${pick(LAST)}`;
    if (used.has(name)) continue;
    used.add(name);
    const phone = `+5699${String(Math.floor(rand() * 10_000_000)).padStart(7, "0")}`;
    const email = rand() < 0.6 ? `${name.split(" ")[0].toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "")}${Math.floor(rand() * 90 + 10)}@correo.cl` : null;
    customerRows.push({ orgId: org.id, name, phone, email });
  }
  const customers = await db.insert(s.customers).values(customerRows).returning();
  // Algunos clientes frecuentes vienen mucho más que otros.
  const weightedCustomers = [...customers, ...customers.slice(0, 15), ...customers.slice(0, 6)];

  const svcWeights = [svc[0], svc[0], svc[0], svc[1], svc[1], svc[1], svc[2], svc[2], svc[3], svc[4], svc[5]];

  // Bloqueo de ejemplo: Camila con trámite el próximo jueves en la mañana.
  const today = todayLocal(TZ);
  let thursday = addDaysStr(today, 1);
  while (weekdayOf(thursday) !== 4) thursday = addDaysStr(thursday, 1);
  await db.insert(s.blocks).values({
    orgId: org.id,
    professionalId: pros[1].id,
    startsAt: localToUtc(thursday, "10:00", TZ),
    endsAt: localToUtc(thursday, "12:00", TZ),
    reason: "Trámite personal",
  });

  const now = Date.now();
  const appts: Array<typeof s.appointments.$inferInsert> = [];
  for (let offset = -35; offset <= 10; offset++) {
    const day = addDaysStr(today, offset);
    const wd = weekdayOf(day);
    const fill = offset < 0 ? 0.72 : Math.max(0.12, 0.7 - offset * 0.06);
    const usedToday = new Set<string>();
    const pickCustomer = () => {
      for (let i = 0; i < 20; i++) {
        const c = pick(weightedCustomers);
        if (!usedToday.has(c.id)) {
          usedToday.add(c.id);
          return c;
        }
      }
      return pick(customers);
    };
    for (const p of pros) {
      for (const h of hours.filter((x) => x.professionalId === p.id && x.weekday === wd)) {
        let t = h.startMin;
        while (t < h.endMin) {
          const service = pick(svcWeights);
          if (t + service.durationMin > h.endMin) break;
          const startsAt = localToUtc(day, minutesToHHMM(t), TZ);
          if (p.id === pros[1].id && day === thursday && t < 720) {
            t += 30;
            continue;
          }
          if (rand() < fill) {
            const past = startsAt.getTime() < now;
            const online = rand() < 0.75;
            let status: s.AppointmentStatus = "confirmed";
            if (past) {
              const r = rand();
              status = r < 0.85 ? "completed" : r < 0.93 ? "no_show" : "cancelled";
            } else if (rand() < 0.05) status = "cancelled";
            const deposit = online ? service.deposit : 0;
            appts.push({
              orgId: org.id,
              professionalId: p.id,
              serviceId: service.id,
              customerId: pickCustomer().id,
              startsAt,
              endsAt: new Date(startsAt.getTime() + service.durationMin * 60_000),
              status,
              price: service.price,
              depositAmount: deposit,
              depositStatus: deposit > 0 ? (status === "cancelled" ? "refunded" : "paid") : "none",
              paymentRef: deposit > 0 ? `DEMO-${Math.floor(rand() * 1e8)}` : null,
              manageToken: newToken(),
              source: online ? "online" : "panel",
              reminderSentAt: past && status !== "cancelled" ? new Date(startsAt.getTime() - 24 * 3600_000) : null,
              customerConfirmedAt: past && status === "completed" && rand() < 0.7 ? new Date(startsAt.getTime() - 20 * 3600_000) : null,
              cancelledAt: status === "cancelled" ? new Date(startsAt.getTime() - 26 * 3600_000) : null,
              createdAt: new Date(startsAt.getTime() - (2 + Math.floor(rand() * 8)) * 24 * 3600_000),
            });
            t += service.durationMin;
          } else {
            t += 30;
          }
        }
      }
    }
  }
  for (let i = 0; i < appts.length; i += 200) await db.insert(s.appointments).values(appts.slice(i, i + 200));
}
