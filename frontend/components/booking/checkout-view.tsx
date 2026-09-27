"use client";

import { Ban, CalendarCheck, CircleCheck, CircleX, SearchX } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { ReactNode } from "react";

import { BookingSteps } from "@/components/booking/booking-steps";
import { OrderSummary } from "@/components/booking/order-summary";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/common/states";
import { PaymentPanel } from "@/components/payment/payment-panel";
import { buttonVariants } from "@/components/ui/button";
import { ApiError, errorMessage, getBooking } from "@/lib/api";
import { bookingCode, formatDateTime } from "@/lib/format";
import { FAILURE_REASONS } from "@/lib/payment-reasons";
import type { Booking } from "@/lib/types";
import { useResource } from "@/lib/use-resource";
import { cn } from "@/lib/utils";

function Outcome({
  tone,
  icon: Icon,
  title,
  children,
  actions,
}: {
  tone: "good" | "bad" | "neutral";
  icon: typeof CircleCheck;
  title: string;
  children: ReactNode;
  actions: ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-xl border bg-card p-8 text-center">
      <span
        className={cn(
          "mx-auto flex size-16 items-center justify-center rounded-full",
          tone === "good" && "bg-emerald-50 text-emerald-600",
          tone === "bad" && "bg-red-50 text-red-600",
          tone === "neutral" && "bg-muted text-muted-foreground"
        )}
      >
        <Icon className="size-8" aria-hidden />
      </span>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight">{title}</h1>
      <div className="mx-auto mt-2 max-w-md text-muted-foreground">{children}</div>
      <div className="mt-8 flex flex-wrap justify-center gap-2">{actions}</div>
    </section>
  );
}

function StatusPanel({ booking, onSettled }: { booking: Booking; onSettled: () => void }) {
  const viewBooking = (
    <Link href={`/account/bookings/${booking.id}`} className={buttonVariants({ variant: "outline" })}>
      View booking
    </Link>
  );
  switch (booking.status) {
    case "PENDING":
      return <PaymentPanel booking={booking} onSettled={onSettled} />;
    case "CONFIRMED":
      return (
        <Outcome
          tone="good"
          icon={CircleCheck}
          title="You're booked!"
          actions={
            <>
              <Link href={`/account/bookings/${booking.id}`} className={buttonVariants()}>
                <CalendarCheck /> View booking
              </Link>
              <Link href="/tests" className={buttonVariants({ variant: "outline" })}>
                Book another test
              </Link>
            </>
          }
        >
          Payment received. See you on{" "}
          <span className="font-medium text-foreground">{formatDateTime(booking.appointment_at)}</span>.
          Your booking reference is{" "}
          <span className="font-mono font-medium text-foreground">{bookingCode(booking.id)}</span>.
        </Outcome>
      );
    case "FAILED":
      return (
        <Outcome
          tone="bad"
          icon={CircleX}
          title="Payment failed"
          actions={
            <>
              <Link href={`/book?centreTestId=${booking.centre_test.id}`} className={buttonVariants()}>
                Book this test again
              </Link>
              {viewBooking}
            </>
          }
        >
          {booking.payment?.failure_reason && (
            <span className="mb-3 block rounded-lg border border-red-200 bg-red-50 p-3 text-left text-sm text-red-900">
              <span className="block font-medium">{FAILURE_REASONS[booking.payment.failure_reason].label}</span>
              {FAILURE_REASONS[booking.payment.failure_reason].hint}
            </span>
          )}
          This booking wasn&apos;t confirmed and no money was taken. You can book the same test again
          and choose a new slot.
        </Outcome>
      );
    case "CANCELLED":
      return (
        <Outcome
          tone="neutral"
          icon={Ban}
          title="This booking was cancelled"
          actions={
            <Link href="/tests" className={buttonVariants()}>
              Browse tests
            </Link>
          }
        >
          {booking.cancellation ? `Reason: ${booking.cancellation.reason}. ` : ""}
          It can no longer be paid for. If you had already paid, the amount is refunded.
        </Outcome>
      );
  }
}

export function CheckoutView() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const { data: booking, error, reload } = useResource(
    () => getBooking(Number(bookingId)),
    `booking:${bookingId}`
  );

  const wrap = (content: ReactNode) => <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{content}</div>;
  if (error instanceof ApiError && error.status === 404) {
    return wrap(
      <EmptyState
        icon={SearchX}
        title="Booking not found"
        action={<Link href="/account/bookings" className={buttonVariants()}>My bookings</Link>}
      />
    );
  }
  if (error) return wrap(<ErrorState message={errorMessage(error)} onRetry={reload} />);
  if (!booking) return wrap(<ListSkeleton rows={3} />);

  const step = booking.status === "CONFIRMED" ? 3 : 1;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Booking <span className="font-mono font-medium text-foreground">{bookingCode(booking.id)}</span>
        </p>
        <BookingSteps current={step} />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <StatusPanel booking={booking} onSettled={reload} />
        <aside className="lg:sticky lg:top-24 lg:h-fit">
          <OrderSummary
            test={booking.centre_test.test}
            centre={booking.centre_test.centre}
            appointment={booking.appointment_at}
            amount={booking.amount}
          />
        </aside>
      </div>
    </div>
  );
}
