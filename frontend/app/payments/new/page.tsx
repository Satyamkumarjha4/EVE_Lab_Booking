"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { ProtectedRoute } from "@/components/protected-route";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createPaymentOrder, simulatePayment } from "@/lib/api";
import type { PaymentMethod } from "@/lib/types";

function PaymentFlow() {
  const params = useSearchParams();
  const router = useRouter();
  const bookingId = params.get("bookingId");
  const amount = params.get("amount");

  const [method, setMethod] = useState<PaymentMethod>("CARD");
  const [reference, setReference] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!bookingId) {
    return <p className="text-sm text-red-600">No booking selected. Go back to your bookings.</p>;
  }

  async function proceedToPay() {
    setError(null);
    setBusy(true);
    try {
      const order = await createPaymentOrder(Number(bookingId), method);
      setReference(order.reference);
    } catch {
      setError("Could not start payment. The booking may already be paid or isn't pending.");
    } finally {
      setBusy(false);
    }
  }

  async function simulate(outcome: "SUCCESS" | "FAILED") {
    if (!reference) return;
    setError(null);
    setBusy(true);
    try {
      const payment = await simulatePayment(reference, outcome);
      setResult(
        `Payment ${payment.status} — booking is now ${
          payment.status === "SUCCESS" ? "CONFIRMED" : "FAILED"
        }.`
      );
      setTimeout(() => router.push("/bookings"), 1500);
    } catch {
      setError("Could not resolve the payment. It may have already been resolved.");
      setTimeout(() => router.push("/bookings"), 1500);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pay for your booking</CardTitle>
        <p className="text-sm text-muted-foreground">Amount: ₹{amount}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs
          value={method}
          onValueChange={(v) => setMethod(v as PaymentMethod)}
        >
          <TabsList>
            <TabsTrigger value="CARD" disabled={!!reference}>
              Card
            </TabsTrigger>
            <TabsTrigger value="UPI" disabled={!!reference}>
              UPI
            </TabsTrigger>
          </TabsList>
          <TabsContent value="CARD" className="space-y-3 pt-3">
            <div className="space-y-1">
              <Label htmlFor="card_number">Card number</Label>
              <Input id="card_number" placeholder="4242 4242 4242 4242" disabled={!!reference} />
            </div>
            <div className="flex gap-3">
              <div className="flex-1 space-y-1">
                <Label htmlFor="expiry">Expiry</Label>
                <Input id="expiry" placeholder="MM/YY" disabled={!!reference} />
              </div>
              <div className="flex-1 space-y-1">
                <Label htmlFor="cvv">CVV</Label>
                <Input id="cvv" placeholder="123" disabled={!!reference} />
              </div>
            </div>
          </TabsContent>
          <TabsContent value="UPI" className="space-y-3 pt-3">
            <div className="space-y-1">
              <Label htmlFor="upi_id">UPI ID</Label>
              <Input id="upi_id" placeholder="name@upi" disabled={!!reference} />
            </div>
            <p className="text-sm text-muted-foreground">
              (QR placeholder — this is a simulation, no real UPI app is contacted.)
            </p>
          </TabsContent>
        </Tabs>

        {!reference && (
          <Button onClick={proceedToPay} disabled={busy}>
            {busy ? "Starting…" : "Proceed to pay"}
          </Button>
        )}

        {reference && !result && (
          <div className="space-y-3 border-t pt-4">
            <p className="text-sm text-muted-foreground">
              Order created. Standing in for your bank/UPI app confirmation step:
            </p>
            <div className="flex gap-3">
              <Button onClick={() => simulate("SUCCESS")} disabled={busy}>
                Simulate Success
              </Button>
              <Button variant="destructive" onClick={() => simulate("FAILED")} disabled={busy}>
                Simulate Failure
              </Button>
            </div>
          </div>
        )}

        {result && <p className="text-sm font-medium">{result}</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </CardContent>
    </Card>
  );
}

export default function PaymentsNewPage() {
  return (
    <ProtectedRoute>
      <div className="mx-auto max-w-md">
        <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
          <PaymentFlow />
        </Suspense>
      </div>
    </ProtectedRoute>
  );
}
