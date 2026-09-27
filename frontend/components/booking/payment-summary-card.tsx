import { formatDateTime, formatINRPrecise } from "@/lib/format";
import { FAILURE_REASONS } from "@/lib/payment-reasons";
import type { Booking } from "@/lib/types";

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={strong ? "flex justify-between border-t pt-2 font-semibold" : "flex justify-between"}>
      <dt className={strong ? undefined : "text-muted-foreground"}>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

/** Price, how it was paid, and where the money went (including partial refunds). */
export function PaymentSummaryCard({ booking }: { booking: Booking }) {
  const payment = booking.payment;
  const refunded = payment?.refund_status === "SIMULATED_REFUNDED";
  const failure = payment?.failure_reason ? FAILURE_REASONS[payment.failure_reason] : null;

  let note: string;
  if (booking.status === "PENDING") note = "Not paid yet. The slot is held for 30 minutes while payment is completed.";
  else if (booking.status === "FAILED") note = "The payment was declined. Nothing was charged.";
  else if (refunded) note = "Refunded to the original payment method.";
  else if (booking.status === "CANCELLED") note = "Cancelled before payment. Nothing was charged.";
  else note = "Paid in full.";

  return (
    <aside className="h-fit rounded-xl border bg-card p-5">
      <h2 className="font-semibold">Payment</h2>
      <dl className="mt-4 space-y-2 text-sm">
        <Line label="Test price" value={formatINRPrecise(booking.amount)} />
        {payment && payment.status !== "INITIATED" && (
          <Line label="Paid by" value={payment.method === "CARD" ? "Card" : "UPI"} />
        )}
        {refunded && payment && (
          <>
            <Line label="Lab's transaction fee" value={`− ${formatINRPrecise(payment.fee_amount)}`} />
            <Line label="Refunded" value={formatINRPrecise(payment.refund_amount)} strong />
          </>
        )}
        {!refunded && <Line label="Total" value={formatINRPrecise(booking.amount)} strong />}
      </dl>
      <p className="mt-4 rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">{note}</p>
      {failure && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          <p className="font-medium">{failure.label}</p>
          <p className="mt-0.5 text-red-800">{failure.hint}</p>
        </div>
      )}
      <p className="mt-4 text-xs text-muted-foreground">Booked {formatDateTime(booking.created_at)}</p>
    </aside>
  );
}
