import { BellRing, CalendarCheck2, ChartColumn, CreditCard, Smartphone, Users } from "lucide-react";
import { ButtonLink, Card, DemoBanner } from "@stackline/core/ui";
import { DEMO_SLUG } from "@/db/seed";

const features = [
  { icon: Smartphone, title: "Reservas desde el celular", text: "Un enlace para la bio de Instagram. Tus clientes eligen servicio, profesional y hora en menos de un minuto." },
  { icon: CreditCard, title: "Abono al reservar", text: "Cobra un abono con Mercado Pago y deja de perder horas por personas que no llegan." },
  { icon: BellRing, title: "Recordatorios por WhatsApp", text: "Aviso automático el día antes, con botón para confirmar, cambiar o cancelar la hora." },
  { icon: CalendarCheck2, title: "Agenda por profesional", text: "Vista diaria por persona, bloqueos, horarios y citas creadas desde recepción." },
  { icon: Users, title: "Ficha de cada cliente", text: "Historial de visitas, inasistencias y notas, sin buscar en el chat." },
  { icon: ChartColumn, title: "Reportes que importan", text: "Ocupación, ingresos e inasistencias por profesional, para decidir con datos." },
];

export default function Home() {
  return (
    <div className="min-h-dvh bg-canvas">
      <DemoBanner>Demo de Stackline con datos ficticios · Software a medida para pymes en Chile</DemoBanner>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <span className="text-lg font-semibold">
          Reservo<span className="text-brand">.</span>
        </span>
        <div className="flex gap-2">
          <ButtonLink href="/login" variant="ghost" size="sm">
            Entrar
          </ButtonLink>
          <ButtonLink href="/registro" size="sm">
            Crear mi agenda
          </ButtonLink>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6 lg:pt-16">
        <div className="max-w-3xl">
          <p className="text-sm font-medium text-brand">Para barberías, centros de estética, kine y consultas</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            ¿Cuántas horas perdiste este mes por clientes que no llegaron?
          </h1>
          <p className="mt-5 text-lg text-ink-soft">
            Reservo es una agenda online con abono y recordatorios por WhatsApp. Tus clientes reservan solos, a
            cualquier hora, y tú dejas de agendar por chat hasta la medianoche.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/registro" size="lg">
              Crear mi agenda gratis
            </ButtonLink>
            <ButtonLink href={`/reservar/${DEMO_SLUG}`} size="lg" variant="secondary">
              Probar como cliente
            </ButtonLink>
            <ButtonLink href="/login" size="lg" variant="ghost">
              Ver el panel de ejemplo
            </ButtonLink>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <Card key={f.title} className="p-6">
              <f.icon className="size-6 text-brand" />
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-ink-soft">{f.text}</p>
            </Card>
          ))}
        </div>

        <Card className="mt-10 flex flex-col items-start justify-between gap-4 p-8 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-xl font-semibold">14 días gratis, sin tarjeta</h2>
            <p className="mt-1 text-ink-soft">
              Crea tu agenda con tu marca, tus servicios y tus reglas de abono. Hecho por Stackline en Chile.
            </p>
          </div>
          <ButtonLink href="/registro" size="lg">
            Empezar ahora
          </ButtonLink>
        </Card>
      </section>
    </div>
  );
}
