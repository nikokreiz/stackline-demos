"use client";

import { useState, useTransition } from "react";
import { ArrowLeft, Check, Clock, UserRound } from "lucide-react";
import { clp } from "@stackline/core/format";
import { Button, Card, Field, Input, cn } from "@stackline/core/ui";
import { SlotPicker } from "@/components/slot-picker";
import { bookAction, getSlotsAction } from "./actions";

type ServiceOpt = { id: string; name: string; description: string | null; durationMin: number; price: number; deposit: number };
type ProOpt = { id: string; name: string; title: string | null; color: string };

const STEPS = ["Servicio", "Profesional", "Fecha y hora", "Tus datos"];

function longDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const s = new Intl.DateTimeFormat("es-CL", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d, 12)),
  );
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function BookingFlow({
  slug,
  today,
  days,
  services,
  professionals,
}: {
  slug: string;
  today: string;
  days: number;
  services: ServiceOpt[];
  professionals: ProOpt[];
}) {
  const [step, setStep] = useState(0);
  const [service, setService] = useState<ServiceOpt | null>(null);
  const [proId, setProId] = useState<string | null>(null);
  const [slot, setSlot] = useState<{ date: string; time: string | null; professionalIds?: string[] }>({
    date: today,
    time: null,
  });
  const [form, setForm] = useState({ name: "", phone: "", email: "" });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const assignedPro =
    professionals.find((p) => p.id === proId) ??
    (slot.professionalIds?.[0] ? professionals.find((p) => p.id === slot.professionalIds![0]) : undefined);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!service || !slot.time) return;
    setError(null);
    start(async () => {
      const res = await bookAction({
        slug,
        serviceId: service.id,
        professionalId: proId,
        date: slot.date,
        time: slot.time!,
        ...form,
      });
      if (res.ok) window.location.href = res.redirectTo;
      else {
        setError(res.error);
        if (res.error.includes("hora")) {
          setSlot((s) => ({ ...s, time: null }));
          setStep(2);
        }
      }
    });
  }

  return (
    <div>
      <ol className="mb-6 flex gap-2">
        {STEPS.map((label, i) => (
          <li key={label} className="flex-1">
            <div className={cn("h-1 rounded-full", i <= step ? "bg-brand" : "bg-line")} />
            <span className={cn("mt-1.5 hidden text-xs sm:block", i === step ? "font-medium text-ink" : "text-ink-soft")}>
              {label}
            </span>
          </li>
        ))}
      </ol>

      {step > 0 && (
        <button
          type="button"
          onClick={() => setStep(step - 1)}
          className="mb-4 flex items-center gap-1 text-sm text-ink-soft hover:text-ink cursor-pointer"
        >
          <ArrowLeft className="size-4" /> Volver
        </button>
      )}

      {step === 0 && (
        <section>
          <h2 className="mb-4 text-lg font-semibold">¿Qué te quieres hacer?</h2>
          <div className="grid gap-3">
            {services.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setService(s);
                  setSlot((v) => ({ ...v, time: null }));
                  setStep(1);
                }}
                className="rounded-xl border border-line bg-surface p-4 text-left transition-colors hover:border-brand cursor-pointer"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium">{s.name}</p>
                    {s.description && <p className="mt-0.5 text-sm text-ink-soft">{s.description}</p>}
                    <p className="mt-2 flex items-center gap-1 text-xs text-ink-soft">
                      <Clock className="size-3.5" /> {s.durationMin} min
                      {s.deposit > 0 && <span className="ml-2">· Abono {clp(s.deposit)}</span>}
                    </p>
                  </div>
                  <span className="shrink-0 font-semibold tabular-nums">{clp(s.price)}</span>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {step === 1 && (
        <section>
          <h2 className="mb-4 text-lg font-semibold">¿Con quién?</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <ProButton
              active={proId === null}
              title="Cualquier profesional"
              subtitle="Te mostramos todas las horas libres"
              color="var(--brand)"
              onClick={() => {
                setProId(null);
                setSlot((v) => ({ ...v, time: null }));
                setStep(2);
              }}
            />
            {professionals.map((p) => (
              <ProButton
                key={p.id}
                active={proId === p.id}
                title={p.name}
                subtitle={p.title ?? ""}
                color={p.color}
                onClick={() => {
                  setProId(p.id);
                  setSlot((v) => ({ ...v, time: null }));
                  setStep(2);
                }}
              />
            ))}
          </div>
        </section>
      )}

      {step === 2 && service && (
        <section>
          <h2 className="mb-4 text-lg font-semibold">Elige día y hora</h2>
          <SlotPicker
            key={`${service.id}-${proId}`}
            today={today}
            days={days}
            value={slot}
            onChange={setSlot}
            loadSlots={(date) => getSlotsAction(slug, service.id, proId, date)}
          />
          <Button className="mt-6 w-full" size="lg" disabled={!slot.time} onClick={() => setStep(3)}>
            Continuar
          </Button>
        </section>
      )}

      {step === 3 && service && slot.time && (
        <section>
          <Card className="mb-6 p-5">
            <p className="text-sm text-ink-soft">Resumen</p>
            <p className="mt-1 font-semibold">{service.name}</p>
            <p className="text-sm">
              {longDate(slot.date)} a las {slot.time}
              {assignedPro && <> · con {assignedPro.name}</>}
            </p>
            <div className="mt-3 flex justify-between border-t border-line pt-3 text-sm">
              <span className="text-ink-soft">Valor del servicio</span>
              <span className="tabular-nums">{clp(service.price)}</span>
            </div>
            {service.deposit > 0 && (
              <div className="mt-1 flex justify-between text-sm font-medium">
                <span>Abono a pagar ahora</span>
                <span className="tabular-nums">{clp(service.deposit)}</span>
              </div>
            )}
          </Card>

          <form onSubmit={submit} className="space-y-4">
            <Field label="Nombre y apellido" htmlFor="name">
              <Input
                id="name"
                required
                autoComplete="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>
            <Field label="WhatsApp" htmlFor="phone" hint="Te enviaremos la confirmación y un recordatorio el día antes.">
              <Input
                id="phone"
                required
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="+56 9 1234 5678"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </Field>
            <Field label="Correo (opcional)" htmlFor="email">
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Field>
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <Button type="submit" size="lg" className="w-full" disabled={pending}>
              {pending
                ? "Reservando…"
                : service.deposit > 0
                  ? `Reservar y pagar abono de ${clp(service.deposit)}`
                  : "Confirmar reserva"}
            </Button>
            {service.deposit > 0 && (
              <p className="text-center text-xs text-ink-soft">
                El abono se descuenta del valor total. La hora queda retenida 20 minutos mientras pagas.
              </p>
            )}
          </form>
        </section>
      )}
    </div>
  );
}

function ProButton({
  title,
  subtitle,
  color,
  active,
  onClick,
}: {
  title: string;
  subtitle: string;
  color: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-xl border bg-surface p-4 text-left transition-colors hover:border-brand cursor-pointer",
        active ? "border-brand" : "border-line",
      )}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full text-white" style={{ background: color }}>
        <UserRound className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{title}</span>
        <span className="block truncate text-sm text-ink-soft">{subtitle}</span>
      </span>
      {active && <Check className="size-4 text-brand" />}
    </button>
  );
}
