import { AlarmClock } from "lucide-react";

import { STATUS_META } from "@/lib/status";
import type { BookingStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

/** A booking status as icon + label. `overdue` flags a confirmed booking past its slot. */
export function StatusBadge({
  status,
  overdue = false,
  className,
}: {
  status: BookingStatus;
  overdue?: boolean;
  className?: string;
}) {
  const meta = STATUS_META[status];
  const Icon = overdue ? AlarmClock : meta.icon;
  return (
    <span
      title={overdue ? "Past the appointment time and not yet marked completed" : meta.description}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset",
        overdue ? "bg-orange-50 text-orange-800 ring-orange-600/20" : meta.badge,
        className
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {overdue ? "Arrival overdue" : meta.label}
    </span>
  );
}
