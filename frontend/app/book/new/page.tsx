"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";

import { ProtectedRoute } from "@/components/protected-route";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createBooking } from "@/lib/api";

function BookingForm() {
  const params = useSearchParams();
  const router = useRouter();
  const centreTestId = params.get("centreTestId");
  const centreName = params.get("centreName");
  const testName = params.get("testName");
  const price = params.get("price");

  const [appointmentAt, setAppointmentAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!centreTestId) {
    return <p className="text-sm text-red-600">No test selected. Go back to the catalog.</p>;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const booking = await createBooking(
        Number(centreTestId),
        new Date(appointmentAt).toISOString()
      );
      router.push(`/payments/new?bookingId=${booking.id}&amount=${booking.amount}`);
    } catch {
      setError("Could not create the booking. Check the date is in the future.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Book a test</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="font-medium">{testName}</p>
          <p className="text-sm text-muted-foreground">{centreName}</p>
          <p className="text-sm text-muted-foreground">Amount: ₹{price}</p>
        </div>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-1">
            <Label htmlFor="appointment_at">Appointment date &amp; time</Label>
            <Input
              id="appointment_at"
              type="datetime-local"
              required
              value={appointmentAt}
              onChange={(e) => setAppointmentAt(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={submitting}>
            {submitting ? "Booking…" : "Confirm booking"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function BookNewPage() {
  return (
    <ProtectedRoute>
      <div className="mx-auto max-w-md">
        <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
          <BookingForm />
        </Suspense>
      </div>
    </ProtectedRoute>
  );
}
