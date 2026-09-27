"use client";

import { CircleCheck, FileCheck2, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { completeBooking, deliverReport, errorMessage } from "@/lib/api";
import { centreDate, centreToday } from "@/lib/slots";
import type { Booking } from "@/lib/types";

/** Centre staff / lab record the visit and the report: CONFIRMED → COMPLETED → REPORT_DELIVERED. */
export function VisitActions({
  booking,
  onChange,
}: {
  booking: Booking;
  onChange: (booking: Booking) => void;
}) {
  const [busy, setBusy] = useState(false);

  const action =
    booking.status === "CONFIRMED"
      ? { label: "Mark test completed", icon: CircleCheck, run: completeBooking, done: "Test marked as completed" }
      : booking.status === "COMPLETED"
        ? { label: "Mark report delivered", icon: FileCheck2, run: deliverReport, done: "Report marked as delivered" }
        : null;
  if (!action) return null;
  // The backend only accepts completion from the appointment's (centre-local) day on.
  const tooEarly = booking.status === "CONFIRMED" && centreDate(booking.appointment_at) > centreToday();

  async function run() {
    if (!action) return;
    setBusy(true);
    try {
      onChange(await action.run(booking.id));
      toast.success(action.done);
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't update the booking."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      disabled={busy || tooEarly}
      onClick={run}
      title={tooEarly ? "Available from the day of the appointment" : undefined}
    >
      {busy ? <Loader2 className="animate-spin" /> : <action.icon />}
      {action.label}
    </Button>
  );
}
