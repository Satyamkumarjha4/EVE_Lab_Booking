"use client";

import { useState } from "react";

import { ErrorState, ListSkeleton } from "@/components/common/states";
import { errorMessage, getSlots, listSlotRules } from "@/lib/api";
import { dayLabel, dayState, WEEKDAYS } from "@/lib/slots";
import { useResource } from "@/lib/use-resource";
import { cn } from "@/lib/utils";

import { DayPanel } from "./day-panel";
import { RuleRanges } from "./rule-ranges";

const CALENDAR_DAYS = 28;

const STATE_STYLE = {
  open: "",
  full: "bg-orange-50",
  closed: "bg-muted/60 text-muted-foreground",
} as const;

/**
 * A centre's appointment capacity: the regular week, date overrides, and how full each slot is.
 * Centre staff edit it; the lab sees the same view read-only.
 */
export function SlotManager({ centreId, readOnly }: { centreId: number; readOnly: boolean }) {
  const rules = useResource(() => listSlotRules(centreId), `slot-rules:${centreId}`);
  const days = useResource(() => getSlots(centreId, CALENDAR_DAYS), `slot-days:${centreId}`);
  const [selected, setSelected] = useState<string | null>(null);

  function refresh() {
    rules.reload();
    days.reload();
  }

  const error = rules.error ?? days.error;
  if (error) return <ErrorState message={errorMessage(error, "Couldn't load the schedule.")} onRetry={refresh} />;
  if (!rules.data || !days.data) return <ListSkeleton rows={4} />;

  const day = days.data.find((d) => d.date === selected) ?? days.data[0];
  // Pad the calendar so the first date sits under its weekday column (Monday first).
  const lead = (new Date(`${days.data[0].date}T12:00:00`).getDay() + 6) % 7;

  return (
    <div className="space-y-6">
      <section className="rounded-xl border bg-card">
        <div className="border-b p-5">
          <h2 className="font-semibold">Weekly schedule</h2>
          <p className="text-sm text-muted-foreground">
            The regular week. Each range sets how many patients fit in every 30-minute slot.
          </p>
        </div>
        <ul className="divide-y">
          {WEEKDAYS.map((name, weekday) => (
            <li key={name} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center">
              <span className="w-28 shrink-0 text-sm font-medium">{name}</span>
              <RuleRanges
                centreId={centreId}
                rules={rules.data!.filter((r) => r.weekday === weekday)}
                scope={{ weekday }}
                scopeLabel={`Every ${name}`}
                readOnly={readOnly}
                onChange={refresh}
              />
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-6 xl:grid-cols-[340px_1fr]">
        <div className="h-fit rounded-xl border bg-card p-5">
          <h2 className="font-semibold">Next {CALENDAR_DAYS} days</h2>
          <p className="mb-4 text-sm text-muted-foreground">Pick a date to see or change its slots.</p>
          <div className="grid grid-cols-7 gap-1 text-center text-xs">
            {WEEKDAYS.map((name) => (
              <span key={name} className="pb-1 text-muted-foreground">
                {name.slice(0, 2)}
              </span>
            ))}
            {Array.from({ length: lead }, (_, i) => (
              <span key={`pad-${i}`} />
            ))}
            {days.data.map((d) => {
              const state = dayState(d);
              return (
                <button
                  key={d.date}
                  type="button"
                  onClick={() => setSelected(d.date)}
                  aria-pressed={d.date === day.date}
                  title={`${dayLabel(d.date, { weekday: "long", day: "numeric", month: "short" })}: ${state}`}
                  className={cn(
                    "relative rounded-md border py-1.5 text-sm transition hover:border-primary/50",
                    STATE_STYLE[state],
                    d.date === day.date && "border-primary ring-2 ring-primary/30"
                  )}
                >
                  {Number(d.date.slice(8))}
                  {d.source === "override" && (
                    <span className="absolute top-0.5 right-0.5 size-1.5 rounded-full bg-primary" aria-label="custom hours" />
                  )}
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-primary" /> Custom hours</span>
            <span className="flex items-center gap-1"><span className="size-3 rounded-sm border bg-orange-50" /> Fully booked</span>
            <span className="flex items-center gap-1"><span className="size-3 rounded-sm border bg-muted/60" /> Closed</span>
          </div>
        </div>
        <DayPanel centreId={centreId} day={day} rules={rules.data} readOnly={readOnly} onChange={refresh} />
      </section>
    </div>
  );
}
