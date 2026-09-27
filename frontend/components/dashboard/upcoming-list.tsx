import { CalendarClock } from "lucide-react";
import Link from "next/link";

import { StatusBadge } from "@/components/common/status-badge";
import { branchName } from "@/lib/catalog";
import { formatDayLabel, formatTime, plural } from "@/lib/format";
import type { Booking } from "@/lib/types";

import { patientLabel } from "./bookings-table";

/** The next few days of appointments, soonest first. */
export function UpcomingList({ bookings, showCentre }: { bookings: Booking[]; showCentre: boolean }) {
  const shown = bookings.slice(0, 6);
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-semibold">Next 7 days</h2>
        <span className="text-sm text-muted-foreground">{plural(bookings.length, "appointment")}</span>
      </div>
      {shown.length === 0 ? (
        <div className="flex flex-col items-center py-10 text-center text-sm text-muted-foreground">
          <CalendarClock className="mb-2 size-6" aria-hidden />
          No appointments scheduled this week.
        </div>
      ) : (
        <ul className="mt-4 divide-y">
          {shown.map((booking) => (
            <li key={booking.id}>
              <Link
                href={`/dashboard/bookings/${booking.id}`}
                className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-3 hover:bg-muted/50"
              >
                <div className="w-20 shrink-0 text-sm">
                  <p className="font-medium">{formatTime(booking.appointment_at)}</p>
                  <p className="text-xs text-muted-foreground">{formatDayLabel(booking.appointment_at)}</p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{booking.centre_test.test.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {patientLabel(booking)}
                    {showCentre && ` · ${branchName(booking.centre_test.centre)}`}
                  </p>
                </div>
                <StatusBadge status={booking.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
