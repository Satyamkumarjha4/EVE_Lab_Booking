import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

const STEPS = ["Choose a slot", "Pay", "Confirmed"];

/** Progress indicator for the book → pay → confirmed flow. `current` is 0-based. */
export function BookingSteps({ current }: { current: number }) {
  return (
    <ol className="flex items-center gap-2 text-sm" aria-label="Booking progress">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex items-center gap-2" aria-current={active ? "step" : undefined}>
            <span
              className={cn(
                "flex size-6 items-center justify-center rounded-full text-xs font-semibold",
                done && "bg-primary text-primary-foreground",
                active && "bg-primary/15 text-primary ring-1 ring-primary",
                !done && !active && "bg-muted text-muted-foreground"
              )}
            >
              {done ? <Check className="size-3.5" /> : i + 1}
            </span>
            <span className={cn(active ? "font-medium" : "text-muted-foreground", "hidden sm:inline")}>
              {label}
            </span>
            {i < STEPS.length - 1 && <span className="mx-1 h-px w-6 bg-border sm:w-10" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}
