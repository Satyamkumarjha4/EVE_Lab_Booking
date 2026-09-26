"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cancelBooking } from "@/lib/api";
import type { Booking } from "@/lib/types";

const CANCELLABLE: Booking["status"][] = ["PENDING", "CONFIRMED"];

export function BookingRow({
  booking,
  canCancel,
  onCancelled,
}: {
  booking: Booking;
  canCancel: boolean;
  onCancelled: (booking: Booking) => void;
}) {
  const [open, setOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const router = useRouter();

  async function confirmCancel() {
    setCancelling(true);
    try {
      const updated = await cancelBooking(booking.id);
      onCancelled(updated);
      setOpen(false);
    } finally {
      setCancelling(false);
    }
  }

  const showCancel = canCancel && CANCELLABLE.includes(booking.status);
  const showPay = booking.status === "PENDING";

  return (
    <li className="flex items-center justify-between py-3">
      <div>
        <p className="font-medium">{booking.centre_test.test.name}</p>
        <p className="text-sm text-muted-foreground">
          {booking.centre_test.centre.name} · {new Date(booking.appointment_at).toLocaleString()}
        </p>
        <p className="text-sm text-muted-foreground">₹{booking.amount}</p>
      </div>
      <div className="flex items-center gap-3">
        <StatusBadge status={booking.status} />
        {showPay && (
          <Button
            size="sm"
            onClick={() =>
              router.push(`/payments/new?bookingId=${booking.id}&amount=${booking.amount}`)
            }
          >
            Pay
          </Button>
        )}
        {showCancel && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button size="sm" variant="destructive" />}>
              Cancel
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Cancel this booking?</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                This cannot be undone. If the booking was already paid, a simulated refund will be
                flagged.
              </p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Keep booking
                </Button>
                <Button variant="destructive" disabled={cancelling} onClick={confirmCancel}>
                  {cancelling ? "Cancelling…" : "Confirm cancel"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </li>
  );
}
