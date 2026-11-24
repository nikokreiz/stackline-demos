"use client";

import { useState, useTransition } from "react";
import { clp } from "@stackline/core/format";
import { Button, Card, Field, Input, Select, Textarea } from "@stackline/core/ui";
import { SlotPicker } from "@/components/slot-picker";
import { createAppointmentAction, panelSlotsAction } from "../../actions";

export function NewAppointmentForm({
  today,
  services,
  professionals,
}: {
  today: string;
  services: Array<{ id: string; name: string; durationMin: number; price: number }>;
  professionals: Array<{ id: string; name: string }>;
}) {
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [proId, setProId] = useState<string>("");
  const [slot, setSlot] = useState<{ date: string; time: string | null; professionalIds?: string[] }>({ date: today, time: null });
  const [customer, setCustomer] = useState({ name: "", phone: "", email: "", notes: "" });
  const [notify, setNotify] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <Card className="p-5 lg:col-span-3">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Servicio" htmlFor="service">
            <Select
              id="service"
              value={serviceId}
              onChange={(e) => {
                setServiceId(e.target.value);
                setSlot((s) => ({ ...s, time: null }));
              }}
            >
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {s.durationMin} min · {clp(s.price)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Profesional" htmlFor="pro">
            <Select
              id="pro"
              value={proId}
              onChange={(e) => {
                setProId(e.target.value);
                setSlot((s) => ({ ...s, time: null }));
              }}
            >
              <option value="">Cualquiera disponible</option>
              {professionals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="mt-6">
          <SlotPicker
            key={`${serviceId}-${proId}`}
            today={today}
            days={21}
            value={slot}
            onChange={setSlot}
            loadSlots={(date) => panelSlotsAction(serviceId, proId || null, date)}
          />
        </div>
      </Card>

      <Card className="p-5 lg:col-span-2">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!slot.time) return setError("Elige una hora.");
            setError(null);
            start(async () => {
              const res = await createAppointmentAction({
                serviceId,
                professionalId: proId || null,
                date: slot.date,
                time: slot.time!,
                ...customer,
                notify,
              });
              if (res?.error) setError(res.error);
            });
          }}
        >
          <Field label="Nombre del cliente" htmlFor="name">
            <Input id="name" required value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} />
          </Field>
          <Field label="Teléfono" htmlFor="phone" hint="Si ya existe, se usa la ficha del cliente.">
            <Input id="phone" required type="tel" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} />
          </Field>
          <Field label="Correo (opcional)" htmlFor="email">
            <Input id="email" type="email" value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} />
          </Field>
          <Field label="Nota interna" htmlFor="notes">
            <Textarea id="notes" rows={2} value={customer.notes} onChange={(e) => setCustomer({ ...customer, notes: e.target.value })} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
            Enviar confirmación por WhatsApp
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={pending || !slot.time}>
            {pending ? "Guardando…" : slot.time ? `Agendar ${slot.date.split("-").reverse().join("/")} ${slot.time}` : "Elige una hora"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
