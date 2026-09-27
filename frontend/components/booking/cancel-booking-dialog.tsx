"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cancelBooking, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatDateTime, formatINRPrecise } from "@/lib/format";
import type { Booking } from "@/lib/types";
import { cn } from "@/lib/utils";

const PATIENT_REASONS = [
  "Schedule conflict",
  "Booked the wrong test",
  "Feeling unwell, will rebook",
  "Found a centre closer to home",
];
const LAB_REASONS = ["Analyser under maintenance", "Technician unavailable", "Reagent out of stock"];
const OTHER = "Other";

/** What a cancellation refunds: the patient pays the lab's fee on a paid booking, the lab doesn't. */
export function refundPreview(booking: Booking, byLab: boolean) {
  if (booking.status !== "CONFIRMED") return null;
  const amount = Number(booking.amount);
  const percent = byLab ? 0 : Number(booking.centre_test.centre.lab.transaction_fee_percent);
  const fee = Math.round(amount * percent) / 100;
  return { refund: amount - fee, fee, percent };
}

export function CancelBookingDialog({
  booking,
  onCancelled,
  size = "sm",
}: {
  booking: Booking;
  onCancelled: (booking: Booking) => void;
  size?: "sm" | "default";
}) {
  const { user } = useAuth();
  const byLab = user?.role === "LAB";
  const presets = [...(byLab ? LAB_REASONS : PATIENT_REASONS), OTHER];
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<string | null>(null);
  const [other, setOther] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const reason = choice === OTHER ? other.trim() : choice;
  const preview = refundPreview(booking, byLab);

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setChoice(null);
      setOther("");
    }
  }

  async function confirm() {
    if (!reason) return;
    setCancelling(true);
    try {
      const updated = await cancelBooking(booking.id, reason);
      toast.success(
        preview ? `Booking cancelled. ${formatINRPrecise(preview.refund)} will be refunded.` : "Booking cancelled."
      );
      onCancelled(updated);
      setOpen(false);
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't cancel the booking."));
    } finally {
      setCancelling(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button size={size} variant="destructive" />}>Cancel</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cancel this booking?</DialogTitle>
          <DialogDescription>
            {booking.centre_test.test.name} on {formatDateTime(booking.appointment_at)}.
          </DialogDescription>
        </DialogHeader>

        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium">Reason</legend>
          <div className="flex flex-wrap gap-2">
            {presets.map((preset) => (
              <button
                key={preset}
                type="button"
                aria-pressed={choice === preset}
                onClick={() => setChoice(preset)}
                className={cn(
                  "rounded-full border px-3 py-1 text-sm transition-colors",
                  choice === preset
                    ? "border-primary bg-primary text-primary-foreground"
                    : "hover:border-primary/40"
                )}
              >
                {preset}
              </button>
            ))}
          </div>
          {choice === OTHER && (
            <Input
              autoFocus
              maxLength={255}
              placeholder="Tell us why"
              aria-label="Cancellation reason"
              value={other}
              onChange={(e) => setOther(e.target.value)}
            />
          )}
        </fieldset>

        <div className="rounded-lg bg-muted/60 p-3 text-sm">
          {preview ? (
            <>
              <p>
                <span className="font-medium">{formatINRPrecise(preview.refund)}</span> will be
                refunded to the original payment method.
              </p>
              <p className="text-muted-foreground">
                {byLab
                  ? "Cancelled by the lab, so the patient gets a full refund."
                  : `${formatINRPrecise(preview.fee)} (${preview.percent}%) is kept as the lab's transaction fee.`}
              </p>
            </>
          ) : (
            <p className="text-muted-foreground">Not paid yet, so nothing is charged.</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Keep booking
          </Button>
          <Button variant="destructive" disabled={!reason || cancelling} onClick={confirm}>
            {cancelling && <Loader2 className="animate-spin" />}
            Cancel booking
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
