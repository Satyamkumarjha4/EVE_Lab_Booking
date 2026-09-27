"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { CancelBookingDialog } from "@/components/booking/cancel-booking-dialog";
import { StatusBadge } from "@/components/common/status-badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { branchName } from "@/lib/catalog";
import { bookingCode, formatDayLabel, formatINR, formatTime } from "@/lib/format";
import { canCancel } from "@/lib/roles";
import { isArrivalOverdue, outcomeReason } from "@/lib/status";
import type { Booking, Me } from "@/lib/types";

export function patientLabel(booking: Booking) {
  return booking.patient?.full_name || booking.patient?.email || "Walk-in";
}

export function BookingsTable({
  bookings,
  user,
  showCentre,
  onChange,
  now,
}: {
  bookings: Booking[];
  user: Me;
  showCentre: boolean;
  /** When given, rows the user may cancel get a Cancel action. */
  onChange?: (booking: Booking) => void;
  now: number;
}) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="pl-4">Patient</TableHead>
            <TableHead>Test</TableHead>
            {showCentre && <TableHead>Centre</TableHead>}
            <TableHead>Appointment</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-0 pr-4"><span className="sr-only">Actions</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {bookings.map((booking) => (
            <TableRow key={booking.id}>
              <TableCell className="max-w-48 pl-4">
                <Link href={`/dashboard/bookings/${booking.id}`} className="block truncate font-medium hover:underline">
                  {patientLabel(booking)}
                </Link>
                <p className="font-mono text-xs text-muted-foreground">{bookingCode(booking.id)}</p>
              </TableCell>
              <TableCell className="max-w-56">
                <p className="truncate font-medium" title={booking.centre_test.test.name}>
                  {booking.centre_test.test.name}
                </p>
              </TableCell>
              {showCentre && (
                <TableCell className="text-muted-foreground">{branchName(booking.centre_test.centre)}</TableCell>
              )}
              <TableCell>
                <p>{formatDayLabel(booking.appointment_at)}</p>
                <p className="text-xs text-muted-foreground">{formatTime(booking.appointment_at)}</p>
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatINR(booking.amount)}</TableCell>
              <TableCell className="max-w-52">
                <StatusBadge status={booking.status} overdue={isArrivalOverdue(booking, now)} />
                {outcomeReason(booking) && (
                  <p className="mt-1 truncate text-xs text-muted-foreground" title={outcomeReason(booking) ?? ""}>
                    {outcomeReason(booking)}
                  </p>
                )}
              </TableCell>
              <TableCell className="pr-4">
                <div className="flex items-center justify-end gap-1">
                  {onChange && canCancel(user, booking, now) && (
                    <CancelBookingDialog booking={booking} onCancelled={onChange} />
                  )}
                  <Link
                    href={`/dashboard/bookings/${booking.id}`}
                    className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
                    aria-label={`Open ${bookingCode(booking.id)}`}
                  >
                    <ChevronRight />
                  </Link>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
