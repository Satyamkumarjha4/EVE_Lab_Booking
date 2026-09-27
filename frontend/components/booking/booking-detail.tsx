"use client";

import {
  AlertTriangle,
  Building2,
  CalendarDays,
  ChevronLeft,
  MapPin,
  Printer,
  SearchX,
  User,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, type ReactNode } from "react";

import { BookingTimeline } from "@/components/booking/booking-timeline";
import { CancelBookingDialog } from "@/components/booking/cancel-booking-dialog";
import { PaymentSummaryCard } from "@/components/booking/payment-summary-card";
import { VisitActions } from "@/components/booking/visit-actions";
import { StatusBadge } from "@/components/common/status-badge";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/common/states";
import { PaymentPanel } from "@/components/payment/payment-panel";
import { Button, buttonVariants } from "@/components/ui/button";
import { ApiError, errorMessage, getBooking } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { branchName, parseLocation } from "@/lib/catalog";
import { bookingCode, formatDateTime, formatINRPrecise } from "@/lib/format";
import { ACTOR_LABEL, canCancel, canPay, canRecordVisit, isBusiness } from "@/lib/roles";
import { EARNING_STATUSES, isArrivalOverdue } from "@/lib/status";
import type { Booking } from "@/lib/types";
import { useResource } from "@/lib/use-resource";

function Row({ icon: Icon, label, children }: { icon: typeof User; label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="text-sm font-medium">{children}</div>
      </div>
    </div>
  );
}

/** Why a booking stopped short, in plain words. */
function OutcomeNotice({ booking, business, now }: { booking: Booking; business: boolean; now: number }) {
  let title: string | null = null;
  let body: ReactNode = null;
  if (booking.status === "CANCELLED" && booking.cancellation) {
    title = `Cancelled by ${ACTOR_LABEL[booking.cancellation.by_role].toLowerCase()}`;
    body = `Reason: ${booking.cancellation.reason}`;
  } else if (booking.status === "NO_SHOW") {
    title = "The patient didn't arrive";
    body = "The appointment passed without a visit. The lab's fee was kept and the rest refunded.";
  } else if (business && isArrivalOverdue(booking, now)) {
    title = "Arrival overdue";
    body = "Mark the test completed once the sample is taken. Otherwise it's recorded as a no-show two hours after the slot.";
  }
  if (!title) return null;
  return (
    <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>
        <p className="font-medium">{title}</p>
        <p className="mt-0.5">{body}</p>
      </div>
    </div>
  );
}

/** One booking, for patients (/account) and business users (/dashboard) alike. */
export function BookingDetail({ backHref, backLabel }: { backHref: string; backLabel: string }) {
  const { bookingId } = useParams<{ bookingId: string }>();
  const { user } = useAuth();
  const [now] = useState(() => Date.now());
  const resource = useResource(() => getBooking(Number(bookingId)), `booking:${bookingId}`);
  const booking = resource.data;

  const back = (
    <Link href={backHref} className="no-print inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
      <ChevronLeft className="size-4" /> {backLabel}
    </Link>
  );
  if (resource.error instanceof ApiError && resource.error.status === 404) {
    return <EmptyState icon={SearchX} title="Booking not found" description="It doesn't exist or isn't visible to your account." action={back} />;
  }
  if (resource.error) return <ErrorState message={errorMessage(resource.error)} onRetry={resource.reload} />;
  if (!booking) return <ListSkeleton rows={3} />;

  const { centre, test } = booking.centre_test;
  const { locality, city } = parseLocation(centre.location);
  const business = isBusiness(user);
  const replace = (updated: Booking) => resource.setData(() => updated);
  // Patients pay on the checkout page; centre staff collect payment for walk-ins right here.
  const inlinePayment = business && canPay(user, booking);
  const patient = booking.patient;

  return (
    <div className="space-y-6">
      {back}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="font-mono text-sm text-muted-foreground">{bookingCode(booking.id)}</p>
          <h1 className="text-2xl font-semibold tracking-tight">{test.name}</h1>
          <StatusBadge status={booking.status} overdue={isArrivalOverdue(booking, now)} />
        </div>
        <div className="no-print flex flex-wrap gap-2">
          {!business && canPay(user, booking) && (
            <Link href={`/checkout/${booking.id}`} className={buttonVariants()}>
              Pay {formatINRPrecise(booking.amount)}
            </Link>
          )}
          {canRecordVisit(user) && <VisitActions booking={booking} onChange={replace} />}
          {canCancel(user, booking, now) && (
            <CancelBookingDialog size="default" booking={booking} onCancelled={replace} />
          )}
          {EARNING_STATUSES.includes(booking.status) && (
            <Button variant="outline" onClick={() => window.print()}>
              <Printer /> Print receipt
            </Button>
          )}
        </div>
      </div>

      <OutcomeNotice booking={booking} business={business} now={now} />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-6">
          {inlinePayment && <PaymentPanel booking={booking} onSettled={() => resource.reload()} />}
          <section className="grid gap-5 rounded-xl border bg-card p-5 sm:grid-cols-2">
            <Row icon={CalendarDays} label="Appointment">{formatDateTime(booking.appointment_at)}</Row>
            <Row icon={Building2} label="Centre">
              {centre.lab.name}, {branchName(centre)}
            </Row>
            <Row icon={MapPin} label="Address">{locality ? `${locality}, ${city}` : city}</Row>
            <Row icon={User} label="Patient">
              {patient ? (
                <>
                  {patient.full_name || patient.email}
                  <span className="block truncate font-normal text-muted-foreground">
                    {[patient.full_name ? patient.email : null, patient.phone].filter(Boolean).join(" · ")}
                  </span>
                </>
              ) : (
                "Walk-in (no patient details)"
              )}
            </Row>
          </section>
          <section className="rounded-xl border bg-card p-5">
            <h2 className="mb-5 font-semibold">Status history</h2>
            <BookingTimeline booking={booking} />
          </section>
        </div>
        <PaymentSummaryCard booking={booking} />
      </div>
    </div>
  );
}
