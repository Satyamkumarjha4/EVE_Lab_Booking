"use client";

import { CalendarOff, Copy, Loader2, RotateCcw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { createSlotRule, deleteSlotRule, errorMessage } from "@/lib/api";
import { formatTime } from "@/lib/format";
import { dayLabel, WEEKDAYS } from "@/lib/slots";
import type { DaySlots, SlotRule } from "@/lib/types";
import { cn } from "@/lib/utils";

import { RuleRanges } from "./rule-ranges";

/** One date: its hours (weekly or overridden), actions to change them, and seats per slot. */
export function DayPanel({
  centreId,
  day,
  rules,
  readOnly,
  onChange,
}: {
  centreId: number;
  day: DaySlots;
  rules: SlotRule[];
  readOnly: boolean;
  onChange: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const weekday = (new Date(`${day.date}T12:00:00`).getDay() + 6) % 7;
  const overrides = rules.filter((r) => r.date === day.date);
  const weekly = rules.filter((r) => r.weekday === weekday);
  const label = dayLabel(day.date, { weekday: "long", day: "numeric", month: "long" });

  async function run(action: () => Promise<unknown>, done: string) {
    setBusy(true);
    try {
      await action();
      toast.success(done);
      onChange();
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't update this day."));
    } finally {
      setBusy(false);
    }
  }

  const copyWeekly = () =>
    run(
      () =>
        Promise.all(
          weekly.map((r) =>
            createSlotRule(centreId, { ...r, weekday: null, date: day.date })
          )
        ),
      "Day customised. Adjust its ranges below."
    );
  const closeDay = () =>
    run(
      () => createSlotRule(centreId, { weekday: null, date: day.date, start_time: "00:00", end_time: "23:30", capacity: 0 }),
      "Day closed"
    );
  const reset = () =>
    run(() => Promise.all(overrides.map((r) => deleteSlotRule(centreId, r.id))), "Back to the weekly schedule");

  return (
    <div className="space-y-5 rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{label}</h3>
          <p className="text-sm text-muted-foreground">
            {day.source === "override"
              ? "Custom hours for this date (replace the weekly schedule)."
              : `Using the weekly schedule for ${WEEKDAYS[weekday]}.`}
          </p>
        </div>
        {!readOnly && (
          <div className="flex flex-wrap gap-2">
            {day.source === "weekly" ? (
              <>
                <Button variant="outline" size="sm" disabled={busy || weekly.length === 0} onClick={copyWeekly}>
                  {busy ? <Loader2 className="animate-spin" /> : <Copy />} Customise this day
                </Button>
                <Button variant="outline" size="sm" disabled={busy} onClick={closeDay} className="text-red-700">
                  <CalendarOff /> Close this day
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" disabled={busy} onClick={reset}>
                {busy ? <Loader2 className="animate-spin" /> : <RotateCcw />} Reset to weekly
              </Button>
            )}
          </div>
        )}
      </div>

      {day.source === "override" && (
        <RuleRanges
          centreId={centreId}
          rules={overrides}
          scope={{ date: day.date }}
          scopeLabel={label}
          readOnly={readOnly}
          onChange={onChange}
        />
      )}

      {day.slots.some((s) => s.capacity > 0) ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {day.slots
            .filter((s) => s.capacity > 0)
            .map((slot) => {
              const used = slot.capacity ? Math.min(slot.booked / slot.capacity, 1) : 1;
              return (
                <div key={slot.start} className="rounded-lg border p-2.5 text-sm">
                  <div className="flex items-baseline justify-between">
                    <span className="font-medium tabular-nums">{formatTime(slot.start)}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {slot.booked}/{slot.capacity} booked
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-r bg-muted">
                    <div
                      className={cn("h-full rounded-r-[4px]", slot.remaining === 0 ? "bg-orange-500" : "bg-chart-1")}
                      style={{ width: `${used * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Closed. No bookings can be made on this day.
        </p>
      )}
    </div>
  );
}
