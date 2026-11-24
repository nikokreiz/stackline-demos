"use client";

import { useState, useTransition } from "react";
import { Button } from "@stackline/core/ui";
import { SlotPicker } from "@/components/slot-picker";
import { rescheduleAction, rescheduleSlotsAction } from "./actions";

export function Reschedule({ token, today, days }: { token: string; today: string; days: number }) {
  const [open, setOpen] = useState(false);
  const [slot, setSlot] = useState<{ date: string; time: string | null }>({ date: today, time: null });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!open)
    return (
      <Button variant="secondary" className="w-full" onClick={() => setOpen(true)}>
        Cambiar la hora
      </Button>
    );

  return (
    <div className="rounded-xl border border-line p-4">
      <p className="mb-3 text-sm font-medium">Elige la nueva hora</p>
      <SlotPicker
        today={today}
        days={days}
        value={slot}
        onChange={setSlot}
        loadSlots={(date) => rescheduleSlotsAction(token, date)}
      />
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <div className="mt-4 flex gap-2">
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Volver
        </Button>
        <Button
          className="flex-1"
          disabled={!slot.time || pending}
          onClick={() =>
            start(async () => {
              const res = await rescheduleAction(token, slot.date, slot.time!);
              if (res.error) setError(res.error);
              else setOpen(false);
            })
          }
        >
          {pending ? "Guardando…" : "Confirmar cambio"}
        </Button>
      </div>
    </div>
  );
}
