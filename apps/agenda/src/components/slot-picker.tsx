"use client";

import { useEffect, useState, useTransition } from "react";
import { cn } from "@stackline/core/ui";

export type SlotOption = { time: string; professionalIds: string[] };

const pad = (n: number) => String(n).padStart(2, "0");
function addDays(dateStr: string, n: number) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}
function dayParts(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  const wd = new Intl.DateTimeFormat("es-CL", { weekday: "short", timeZone: "UTC" }).format(dt).replace(".", "");
  const mon = new Intl.DateTimeFormat("es-CL", { month: "short", timeZone: "UTC" }).format(dt).replace(".", "");
  return { wd, day: d, mon };
}

/** Tira de días + grilla de horas disponibles. Las horas las entrega `loadSlots` (server action). */
export function SlotPicker({
  today,
  days,
  loadSlots,
  value,
  onChange,
}: {
  today: string;
  days: number;
  loadSlots: (date: string) => Promise<SlotOption[]>;
  value: { date: string; time: string | null; professionalIds?: string[] };
  onChange: (v: { date: string; time: string | null; professionalIds?: string[] }) => void;
}) {
  const [slots, setSlots] = useState<SlotOption[] | null>(null);
  const [pending, start] = useTransition();
  const dates = Array.from({ length: days }, (_, i) => addDays(today, i));

  useEffect(() => {
    let alive = true;
    setSlots(null);
    start(async () => {
      const res = await loadSlots(value.date);
      if (alive) setSlots(res);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.date]);

  return (
    <div>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
        {dates.map((d) => {
          const p = dayParts(d);
          const active = d === value.date;
          return (
            <button
              key={d}
              type="button"
              onClick={() => onChange({ date: d, time: null })}
              className={cn(
                "flex w-16 shrink-0 flex-col items-center rounded-xl border px-2 py-2 text-sm transition-colors cursor-pointer",
                active ? "border-brand bg-brand text-white" : "border-line bg-surface hover:border-brand",
              )}
            >
              <span className={cn("text-xs capitalize", active ? "text-white/80" : "text-ink-soft")}>{p.wd}</span>
              <span className="text-lg font-semibold leading-tight">{p.day}</span>
              <span className={cn("text-xs capitalize", active ? "text-white/80" : "text-ink-soft")}>{p.mon}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 min-h-24">
        {pending || slots === null ? (
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-subtle" />
            ))}
          </div>
        ) : slots.length === 0 ? (
          <p className="rounded-lg bg-subtle px-4 py-6 text-center text-sm text-ink-soft">
            No quedan horas este día. Prueba con otra fecha.
          </p>
        ) : (
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {slots.map((s) => (
              <button
                key={s.time}
                type="button"
                onClick={() => onChange({ date: value.date, time: s.time, professionalIds: s.professionalIds })}
                className={cn(
                  "h-10 rounded-lg border text-sm font-medium tabular-nums transition-colors cursor-pointer",
                  value.time === s.time ? "border-brand bg-brand text-white" : "border-line bg-surface hover:border-brand",
                )}
              >
                {s.time}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
