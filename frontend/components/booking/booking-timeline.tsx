import { CalendarCheck, CreditCard, FileCheck2, FilePlus2 } from "lucide-react";

import { formatDateTime } from "@/lib/format";
import { ACTOR_LABEL } from "@/lib/roles";
import { STATUS_META } from "@/lib/status";
import type { Booking, BookingStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

type Tone = "done" | "bad" | "next";

interface Step {
  key: string;
  icon: typeof FilePlus2;
  title: string;
  detail: string;
  note?: string;
  tone: Tone;
}

const BAD: BookingStatus[] = ["FAILED", "CANCELLED", "NO_SHOW"];

// The first two history entries read as actions ("created", "paid"), not as the resulting state.
const EVENT_TITLE: Partial<Record<BookingStatus, string>> = {
  PENDING: "Booking created",
  CONFIRMED: "Payment received",
};
const EVENT_ICON: Partial<Record<BookingStatus, typeof FilePlus2>> = {
  PENDING: FilePlus2,
  CONFIRMED: CreditCard,
};

/** Steps still ahead of a live booking, so the patient/staff see what happens next. */
function upcoming(booking: Booking): Step[] {
  const visit: Step = {
    key: "next-visit",
    icon: CalendarCheck,
    title: "Visit the centre",
    detail: formatDateTime(booking.appointment_at),
    tone: "next",
  };
  const report: Step = {
    key: "next-report",
    icon: FileCheck2,
    title: "Report delivered",
    detail: "Usually within 24–48 hours of the test",
    tone: "next",
  };
  if (booking.status === "PENDING" || booking.status === "CONFIRMED") return [visit, report];
  if (booking.status === "COMPLETED") return [report];
  return [];
}

/** The booking's real history (who did what, when, and why), then what's still to come. */
export function BookingTimeline({ booking }: { booking: Booking }) {
  const steps: Step[] = [
    ...booking.events.map((event, i) => ({
      key: `${event.status}-${i}`,
      icon: EVENT_ICON[event.status] ?? STATUS_META[event.status].icon,
      title: EVENT_TITLE[event.status] ?? STATUS_META[event.status].label,
      detail: `${formatDateTime(event.created_at)} · ${ACTOR_LABEL[event.actor_role]}`,
      note: event.note || undefined,
      tone: (BAD.includes(event.status) ? "bad" : "done") as Tone,
    })),
    ...upcoming(booking),
  ];

  return (
    <ol>
      {steps.map((step, i) => (
        <li key={step.key} className="relative flex gap-4 pb-6 last:pb-0">
          {i < steps.length - 1 && (
            <span aria-hidden className="absolute top-9 bottom-1 left-[17px] w-px bg-border" />
          )}
          <span
            className={cn(
              "relative flex size-9 shrink-0 items-center justify-center rounded-full ring-4 ring-card",
              step.tone === "done" && "bg-emerald-50 text-emerald-700",
              step.tone === "bad" && "bg-red-50 text-red-700",
              step.tone === "next" && "bg-muted text-muted-foreground"
            )}
          >
            <step.icon className="size-4" aria-hidden />
          </span>
          <div className="pt-1.5">
            <p className={cn("text-sm font-medium", step.tone === "next" && "text-muted-foreground")}>
              {step.title}
            </p>
            <p className="text-sm text-muted-foreground">{step.detail}</p>
            {step.note && (
              <p className="mt-1 rounded-md bg-muted/60 px-2 py-1 text-sm">&ldquo;{step.note}&rdquo;</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
