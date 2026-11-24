import Link from "next/link";
import { and, asc, eq, gt, lt } from "drizzle-orm";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { fmtLongDay, fmtTime } from "@stackline/core/format";
import { ButtonLink, Card, PageHeader, cn } from "@stackline/core/ui";
import { addDaysStr, isValidDateStr, localToUtc, minutesToHHMM, toLocalMinutes, todayLocal, weekdayOf } from "@stackline/core/time";
import { blocks, professionals, workingHours } from "@/db/schema";
import { STATUS_LABEL } from "@/lib/labels";
import { panel } from "@/lib/panel";
import { appointmentsBetween } from "@/lib/queries";

export const metadata = { title: "Agenda" };

const PX_PER_MIN = 1.6;

export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ fecha?: string }> }) {
  const { db, orgId, tz } = await panel();
  const sp = await searchParams;
  const today = todayLocal(tz);
  const date = isValidDateStr(sp.fecha) ? sp.fecha : today;
  const from = localToUtc(date, "00:00", tz);
  const to = localToUtc(addDaysStr(date, 1), "00:00", tz);

  const [pros, hours, appts, blks] = await Promise.all([
    db.select().from(professionals).where(and(eq(professionals.orgId, orgId), eq(professionals.active, true))).orderBy(asc(professionals.name)),
    db.select().from(workingHours).where(and(eq(workingHours.orgId, orgId), eq(workingHours.weekday, weekdayOf(date)))),
    appointmentsBetween(db, orgId, from, to),
    db.select().from(blocks).where(and(eq(blocks.orgId, orgId), lt(blocks.startsAt, to), gt(blocks.endsAt, from))),
  ]);

  const visible = appts.filter((a) => a.status !== "cancelled");
  const startMin = Math.min(9 * 60, ...hours.map((h) => h.startMin));
  const endMin = Math.max(20 * 60, ...hours.map((h) => h.endMin));
  const height = (endMin - startMin) * PX_PER_MIN;
  const y = (min: number) => (min - startMin) * PX_PER_MIN;
  const hourMarks: number[] = [];
  for (let m = Math.ceil(startMin / 60) * 60; m <= endMin; m += 60) hourMarks.push(m);
  const cancelled = appts.length - visible.length;

  return (
    <>
      <PageHeader
        title="Agenda"
        description={`${fmtLongDay(from, tz)} · ${visible.length} citas${cancelled ? ` · ${cancelled} canceladas` : ""}`}
        actions={
          <>
            <div className="flex items-center rounded-lg border border-line bg-surface">
              <Link href={`?fecha=${addDaysStr(date, -1)}`} className="p-2 hover:bg-subtle" aria-label="Día anterior">
                <ChevronLeft className="size-4" />
              </Link>
              <Link href={`?fecha=${today}`} className="border-x border-line px-3 py-2 text-sm hover:bg-subtle">
                Hoy
              </Link>
              <Link href={`?fecha=${addDaysStr(date, 1)}`} className="p-2 hover:bg-subtle" aria-label="Día siguiente">
                <ChevronRight className="size-4" />
              </Link>
            </div>
            <form>
              <input
                type="date"
                name="fecha"
                defaultValue={date}
                className="h-10 rounded-lg border border-line bg-surface px-3 text-sm"
              />
              <button className="sr-only">Ir</button>
            </form>
            <ButtonLink href={`/panel/citas/nueva?fecha=${date}`}>
              <Plus className="size-4" /> Nueva cita
            </ButtonLink>
          </>
        }
      />

      <Card className="overflow-x-auto">
        <div className="flex min-w-[640px]">
          <div className="w-14 shrink-0 border-r border-line pt-10">
            <div className="relative" style={{ height }}>
              {hourMarks.map((m) => (
                <span key={m} className="absolute -translate-y-2 pl-2 text-xs text-ink-faint tabular-nums" style={{ top: y(m) }}>
                  {minutesToHHMM(m)}
                </span>
              ))}
            </div>
          </div>
          {pros.map((p) => {
            const myHours = hours.filter((h) => h.professionalId === p.id);
            return (
              <div key={p.id} className="min-w-44 flex-1 border-r border-line last:border-r-0">
                <div className="flex h-10 items-center gap-2 border-b border-line px-3 text-sm font-medium">
                  <span className="size-2.5 rounded-full" style={{ background: p.color }} />
                  <span className="truncate">{p.name}</span>
                </div>
                <div className="relative bg-subtle/60" style={{ height }}>
                  {myHours.map((h) => (
                    <div key={h.id} className="absolute inset-x-0 bg-surface" style={{ top: y(h.startMin), height: (h.endMin - h.startMin) * PX_PER_MIN }} />
                  ))}
                  {hourMarks.map((m) => (
                    <div key={m} className="absolute inset-x-0 border-t border-line/70" style={{ top: y(m) }} />
                  ))}
                  {blks
                    .filter((b) => b.professionalId === p.id)
                    .map((b) => {
                      const s = b.startsAt < from ? startMin : toLocalMinutes(b.startsAt, tz);
                      const e = b.endsAt >= to ? endMin : toLocalMinutes(b.endsAt, tz);
                      return (
                        <div
                          key={b.id}
                          className="absolute inset-x-1 rounded-md border border-dashed border-ink-faint bg-[repeating-linear-gradient(45deg,transparent,transparent_6px,var(--subtle)_6px,var(--subtle)_12px)] px-2 py-1 text-xs text-ink-soft"
                          style={{ top: y(Math.max(s, startMin)), height: (Math.min(e, endMin) - Math.max(s, startMin)) * PX_PER_MIN }}
                        >
                          Bloqueado{b.reason ? ` · ${b.reason}` : ""}
                        </div>
                      );
                    })}
                  {visible
                    .filter((a) => a.professionalId === p.id)
                    .map((a) => {
                      const s = toLocalMinutes(a.startsAt, tz);
                      const e = toLocalMinutes(a.endsAt, tz);
                      return (
                        <Link
                          key={a.id}
                          href={`/panel/citas/${a.id}`}
                          className={cn(
                            "absolute inset-x-1 overflow-hidden rounded-md border-l-4 px-2 py-1 text-xs shadow-sm transition hover:brightness-95",
                            a.status === "no_show" && "opacity-60",
                            a.status === "pending_payment" && "border-dashed",
                          )}
                          style={{
                            top: y(s) + 1,
                            height: (e - s) * PX_PER_MIN - 2,
                            borderLeftColor: a.proColor,
                            background: `color-mix(in srgb, ${a.proColor} 14%, var(--surface))`,
                          }}
                          title={`${a.customerName} · ${a.serviceName} · ${STATUS_LABEL[a.status]}`}
                        >
                          <span className="font-semibold tabular-nums">{fmtTime(a.startsAt, tz)}</span>{" "}
                          <span className="font-medium">{a.customerName}</span>
                          <span className="block truncate text-ink-soft">
                            {a.serviceName}
                            {a.status !== "confirmed" && ` · ${STATUS_LABEL[a.status]}`}
                          </span>
                        </Link>
                      );
                    })}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </>
  );
}
