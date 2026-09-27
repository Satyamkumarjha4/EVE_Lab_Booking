import {
  Ban,
  CalendarClock,
  CircleCheck,
  CircleX,
  Clock,
  FileCheck2,
  type LucideIcon,
  UserX,
} from "lucide-react";

import type { Booking, BookingStatus } from "./types";

interface StatusMeta {
  label: string;
  description: string;
  icon: LucideIcon;
  /** Badge styling: tinted background + dark text, so the label (not the tint) carries meaning. */
  badge: string;
  /** Chart mark color. Statuses always render with their icon and label, never color alone. */
  color: string;
}

export const STATUS_META: Record<BookingStatus, StatusMeta> = {
  PENDING: {
    label: "Payment pending",
    description: "Booked, awaiting payment",
    icon: Clock,
    badge: "bg-amber-50 text-amber-800 ring-amber-600/25",
    color: "#fab219",
  },
  CONFIRMED: {
    label: "Awaiting arrival",
    description: "Paid; the patient hasn't come in yet",
    icon: CalendarClock,
    badge: "bg-sky-50 text-sky-800 ring-sky-600/20",
    color: "#2a78d6",
  },
  COMPLETED: {
    label: "Test completed",
    description: "Sample taken; report being prepared",
    icon: CircleCheck,
    badge: "bg-emerald-50 text-emerald-800 ring-emerald-600/20",
    color: "#0ca30c",
  },
  REPORT_DELIVERED: {
    label: "Report delivered",
    description: "Report shared with the patient",
    icon: FileCheck2,
    badge: "bg-teal-50 text-teal-800 ring-teal-600/25",
    color: "#006300",
  },
  NO_SHOW: {
    label: "Did not arrive",
    description: "Missed the appointment; refunded minus the lab's fee",
    icon: UserX,
    badge: "bg-orange-50 text-orange-800 ring-orange-600/20",
    color: "#ec835a",
  },
  FAILED: {
    label: "Payment failed",
    description: "Payment was declined",
    icon: CircleX,
    badge: "bg-red-50 text-red-800 ring-red-600/20",
    color: "#d03b3b",
  },
  CANCELLED: {
    label: "Cancelled",
    description: "Cancelled; any payment refunded",
    icon: Ban,
    badge: "bg-slate-100 text-slate-700 ring-slate-500/20",
    color: "#898781",
  },
};

/** Lifecycle order, for legends, filters and breakdowns. */
export const STATUS_ORDER: BookingStatus[] = [
  "PENDING",
  "CONFIRMED",
  "COMPLETED",
  "REPORT_DELIVERED",
  "NO_SHOW",
  "FAILED",
  "CANCELLED",
];

/** Paid bookings that count as revenue (cancellations and no-shows only keep the fee). */
export const EARNING_STATUSES: BookingStatus[] = ["CONFIRMED", "COMPLETED", "REPORT_DELIVERED"];

/** A confirmed booking whose appointment has started but nobody has marked it completed yet. */
export function isArrivalOverdue(booking: Booking, now: number) {
  return booking.status === "CONFIRMED" && new Date(booking.appointment_at).getTime() < now;
}

/** Plain-language reason a booking ended where it did, if there is one. */
export function outcomeReason(booking: Booking) {
  if (booking.status === "CANCELLED") return booking.cancellation?.reason ?? null;
  if (booking.status === "FAILED") {
    return booking.events.findLast((e) => e.status === "FAILED")?.note ?? null;
  }
  return null;
}
