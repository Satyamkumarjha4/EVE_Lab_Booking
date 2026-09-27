"use client";

import { CreditCard, Landmark, Loader2, Lock, ShieldCheck, Smartphone, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { CardFields, UpiFields } from "@/components/payment/method-fields";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiError, createPaymentOrder, errorMessage, simulatePayment } from "@/lib/api";
import { formatINRPrecise } from "@/lib/format";
import { FAILURE_REASONS, reasonsFor } from "@/lib/payment-reasons";
import type { Booking, FailureReason, Payment, PaymentMethod } from "@/lib/types";

/**
 * Two-step simulated checkout. "Pay" opens (or resumes) the payment order; the sandbox panel then
 * stands in for the bank OTP page / UPI app, where the customer approves or declines. The
 * simulate call is synchronous and final, so `onSettled` can refresh the booking right away.
 */
export function PaymentPanel({
  booking,
  onSettled,
}: {
  booking: Booking;
  onSettled: (payment: Payment | null) => void;
}) {
  const [method, setMethod] = useState<PaymentMethod>("CARD");
  const [order, setOrder] = useState<Payment | null>(null);
  const [busy, setBusy] = useState<"order" | "SUCCESS" | "FAILED" | null>(null);
  const [declining, setDeclining] = useState(false);

  async function openOrder() {
    setBusy("order");
    try {
      setOrder(await createPaymentOrder(booking.id, method));
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't start the payment."));
      // The booking may have changed underneath us (cancelled, already paid): refresh it.
      if (err instanceof ApiError && (err.status === 400 || err.status === 409)) onSettled(null);
    } finally {
      setBusy(null);
    }
  }

  async function resolve(outcome: "SUCCESS" | "FAILED", reason?: FailureReason) {
    if (!order) return;
    setBusy(outcome);
    try {
      const payment = await simulatePayment(order.reference, outcome, reason);
      if (payment.status === "SUCCESS") toast.success("Payment successful");
      else toast.error(`Payment declined: ${reason ? FAILURE_REASONS[reason].label : "declined"}`);
      onSettled(payment);
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't complete the payment."));
      onSettled(null);
    } finally {
      setBusy(null);
    }
  }

  const amount = formatINRPrecise(booking.amount);

  if (order) {
    const Icon = order.method === "CARD" ? Landmark : Smartphone;
    return (
      <section className="overflow-hidden rounded-xl border bg-card" aria-labelledby="sandbox-title">
        <div className="flex items-center justify-between bg-slate-900 px-5 py-3 text-white">
          <p className="flex items-center gap-2 text-sm font-medium">
            <ShieldCheck className="size-4 text-teal-300" aria-hidden /> EVE Pay · Sandbox
          </p>
          <span className="rounded bg-amber-400/90 px-1.5 py-0.5 text-[11px] font-semibold text-slate-900">
            SIMULATION
          </span>
        </div>
        <div className="space-y-6 p-6 text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
            <Icon className="size-7" aria-hidden />
          </span>
          <div>
            <h2 id="sandbox-title" className="text-lg font-semibold">
              {order.method === "CARD" ? "Authorise with your bank" : "Approve in your UPI app"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              This screen stands in for your bank&apos;s OTP page or UPI app. Choose what the
              customer does.
            </p>
          </div>
          <dl className="mx-auto grid max-w-sm grid-cols-2 gap-y-2 rounded-lg bg-muted/60 p-4 text-left text-sm">
            <dt className="text-muted-foreground">Amount</dt>
            <dd className="text-right font-semibold">{formatINRPrecise(order.amount)}</dd>
            <dt className="text-muted-foreground">Method</dt>
            <dd className="text-right">{order.method === "CARD" ? "Card" : "UPI"}</dd>
            <dt className="text-muted-foreground">Reference</dt>
            <dd className="truncate text-right font-mono text-xs leading-5" title={order.reference}>
              {order.reference.slice(0, 13)}…
            </dd>
          </dl>
          {declining ? (
            <div className="mx-auto max-w-sm space-y-2 text-left">
              <p className="text-sm font-medium">Why does the {order.method === "CARD" ? "bank" : "UPI app"} decline?</p>
              {reasonsFor(order.method).map((reason) => (
                <button
                  key={reason}
                  type="button"
                  disabled={busy !== null}
                  onClick={() => resolve("FAILED", reason)}
                  className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm transition hover:border-red-300 hover:bg-red-50 disabled:opacity-50"
                >
                  {FAILURE_REASONS[reason].label}
                  {busy === "FAILED" && <Loader2 className="size-4 animate-spin" />}
                </button>
              ))}
              <Button variant="ghost" size="sm" disabled={busy !== null} onClick={() => setDeclining(false)}>
                Back
              </Button>
            </div>
          ) : (
            <div className="mx-auto flex max-w-sm flex-col gap-2 sm:flex-row">
              <Button className="h-10 flex-1" disabled={busy !== null} onClick={() => resolve("SUCCESS")}>
                {busy === "SUCCESS" ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
                Approve payment
              </Button>
              <Button
                variant="outline"
                className="h-10 flex-1 text-red-700 hover:bg-red-50 hover:text-red-800"
                disabled={busy !== null}
                onClick={() => setDeclining(true)}
              >
                <X />
                Decline…
              </Button>
            </div>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border bg-card p-5 sm:p-6" aria-labelledby="pay-title">
      <h2 id="pay-title" className="text-xl font-semibold">Payment method</h2>
      <p className="mt-1 mb-5 text-sm text-muted-foreground">
        Any details work here. Nothing is charged: payments are simulated.
      </p>
      <Tabs value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
        <TabsList className="grid h-11! w-full grid-cols-2">
          <TabsTrigger value="CARD">
            <CreditCard /> Card
          </TabsTrigger>
          <TabsTrigger value="UPI">
            <Smartphone /> UPI
          </TabsTrigger>
        </TabsList>
        <TabsContent value="CARD" className="pt-5">
          <CardFields disabled={busy !== null} />
        </TabsContent>
        <TabsContent value="UPI" className="pt-5">
          <UpiFields disabled={busy !== null} seed={booking.id} />
        </TabsContent>
      </Tabs>
      <Button className="mt-6 h-11 w-full text-base" disabled={busy !== null} onClick={openOrder}>
        {busy === "order" ? <Loader2 className="animate-spin" /> : <Lock />}
        Pay {amount}
      </Button>
      <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <Lock className="size-3" aria-hidden /> Paying again for this booking resumes the same order.
      </p>
    </section>
  );
}
