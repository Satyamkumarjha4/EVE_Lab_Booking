import { ChevronRight, Clock, MapPin } from "lucide-react";
import Link from "next/link";

import { CancelBookingDialog } from "@/components/booking/cancel-booking-dialog";
import { StatusBadge } from "@/components/common/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { branchName, parseLocation } from "@/lib/catalog";
import { bookingCode, CENTRE_TIME_ZONE, formatINR, formatTime } from "@/lib/format";
import { outcomeReason } from "@/lib/status";
import type { Booking } from "@/lib/types";

const inCentreTime = (at: Date, options: Intl.DateTimeFormatOptions) =>
  at.toLocaleDateString("en-IN", { ...options, timeZone: CENTRE_TIME_ZONE });

/** A patient's booking in their list: date block, what/where, status and next actions. */
export function BookingCard({
  booking,
  onChange,
  now,
}: {
  booking: Booking;
  onChange: (booking: Booking) => void;
  now: number;
}) {
  const at = new Date(booking.appointment_at);
  const { centre, test } = booking.centre_test;
  const { city } = parseLocation(centre.location);
  const cancellable =
    (booking.status === "PENDING" || booking.status === "CONFIRMED") && at.getTime() > now;
  const reason = outcomeReason(booking);

  return (
    <li className="flex flex-col gap-4 rounded-xl border bg-card p-4 transition hover:border-primary/30 sm:flex-row sm:items-center">
      <div className="flex w-16 shrink-0 flex-col items-center rounded-lg bg-secondary py-2 text-secondary-foreground">
        <span className="text-xs uppercase">{inCentreTime(at, { month: "short" })}</span>
        <span className="text-2xl leading-none font-semibold">{inCentreTime(at, { day: "numeric" })}</span>
        <span className="text-xs">{inCentreTime(at, { weekday: "short" })}</span>
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/account/bookings/${booking.id}`} className="font-semibold hover:underline">
            {test.name}
          </Link>
          <StatusBadge status={booking.status} />
        </div>
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="size-3.5" aria-hidden /> {formatTime(at)}
          </span>
          <span className="flex items-center gap-1">
            <MapPin className="size-3.5" aria-hidden /> {centre.lab.name}, {branchName(centre)}, {city}
          </span>
        </p>
        <p className="text-xs text-muted-foreground">
          <span className="font-mono">{bookingCode(booking.id)}</span> · {formatINR(booking.amount)}
          {reason && <> · {reason}</>}
        </p>
      </div>

      <div className="flex items-center gap-2 sm:justify-end">
        {booking.status === "PENDING" && (
          <Link href={`/checkout/${booking.id}`} className={buttonVariants({ size: "sm" })}>
            Pay now
          </Link>
        )}
        {cancellable && <CancelBookingDialog booking={booking} onCancelled={onChange} />}
        <Link
          href={`/account/bookings/${booking.id}`}
          className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
          aria-label="Booking details"
        >
          <ChevronRight />
        </Link>
      </div>
    </li>
  );
}
