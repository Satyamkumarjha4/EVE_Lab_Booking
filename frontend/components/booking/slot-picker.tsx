"use client";

import { Moon, Sun, Sunrise } from "lucide-react";
import { useState } from "react";

import { ErrorState, ListSkeleton } from "@/components/common/states";
import { errorMessage, getSlots } from "@/lib/api";
import { formatTime } from "@/lib/format";
import { centreToday, dayLabel, dayState, periodOf, type Period } from "@/lib/slots";
import type { DaySlots } from "@/lib/types";
import { useResource } from "@/lib/use-resource";
import { cn } from "@/lib/utils";

const PERIODS: { period: Period; icon: typeof Sun }[] = [
  { period: "Morning", icon: Sunrise },
  { period: "Afternoon", icon: Sun },
  { period: "Evening", icon: Moon },
];

const DAY_NOTE = { open: "", full: "Full", closed: "Closed" } as const;

/**
 * The centre's real slots for the next 14 days, from its schedule and current bookings. `value`
 * and `onChange` use the slot's ISO start time.
 */
export function SlotPicker({
  centreId,
  value,
  onChange,
}: {
  centreId: number;
  value: string | null;
  onChange: (start: string) => void;
}) {
  const schedule = useResource(() => getSlots(centreId, 14), `slots:${centreId}`);
  const [chosenDay, setChosenDay] = useState<string | null>(null);

  if (schedule.error) {
    return <ErrorState message={errorMessage(schedule.error, "Couldn't load slots.")} onRetry={schedule.reload} />;
  }
  if (!schedule.data) return <ListSkeleton rows={3} />;

  const days = schedule.data;
  const firstOpen = days.find((d) => dayState(d) === "open") ?? days[0];
  const day: DaySlots = days.find((d) => d.date === chosenDay) ?? firstOpen;
  const today = centreToday();

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-sm font-medium">Date</p>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2" role="listbox" aria-label="Appointment date">
          {days.map((d) => {
            const selected = d.date === day.date;
            const state = dayState(d);
            return (
              <button
                key={d.date}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => setChosenDay(d.date)}
                className={cn(
                  "flex w-16 shrink-0 flex-col items-center rounded-xl border py-2 transition",
                  selected
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "bg-card hover:border-primary/40",
                  state !== "open" && !selected && "bg-muted/50 text-muted-foreground"
                )}
              >
                <span className={cn("text-xs", selected ? "text-primary-foreground/80" : "text-muted-foreground")}>
                  {d.date === today ? "Today" : dayLabel(d.date, { weekday: "short" })}
                </span>
                <span className="text-lg font-semibold">{Number(d.date.slice(8))}</span>
                <span className={cn("text-[11px]", selected ? "text-primary-foreground/80" : "text-muted-foreground")}>
                  {DAY_NOTE[state] || dayLabel(d.date, { month: "short" })}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {dayState(day) !== "open" ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          {dayState(day) === "closed"
            ? "The centre is closed on this day. Please pick another date."
            : "Every slot on this day is taken. Please pick another date."}
        </p>
      ) : (
        PERIODS.map(({ period, icon: Icon }) => {
          const slots = day.slots.filter((s) => periodOf(s.start) === period && s.capacity > 0);
          if (slots.length === 0) return null;
          return (
            <div key={period}>
              <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                <Icon className="size-4 text-muted-foreground" aria-hidden /> {period}
              </p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                {slots.map((slot) => {
                  const selected = value === slot.start;
                  return (
                    <button
                      key={slot.start}
                      type="button"
                      disabled={!slot.bookable}
                      aria-pressed={selected}
                      onClick={() => onChange(slot.start)}
                      className={cn(
                        "flex flex-col items-center rounded-lg border py-1.5 text-sm font-medium transition",
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "bg-card hover:border-primary/50 hover:text-primary",
                        "disabled:cursor-not-allowed disabled:bg-muted/50 disabled:text-muted-foreground/60 disabled:hover:border-border"
                      )}
                    >
                      {formatTime(slot.start)}
                      <span
                        className={cn(
                          "text-[11px] font-normal",
                          selected ? "text-primary-foreground/80" : "text-muted-foreground"
                        )}
                      >
                        {slot.remaining === 0 ? "Full" : slot.bookable ? `${slot.remaining} left` : "–"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
