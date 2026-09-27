"use client";

import { ChevronLeft, Loader2, SearchX } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { BookingSteps } from "@/components/booking/booking-steps";
import { OrderSummary } from "@/components/booking/order-summary";
import { SlotPicker } from "@/components/booking/slot-picker";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/common/states";
import { Button, buttonVariants } from "@/components/ui/button";
import { ApiError, createBooking, errorMessage } from "@/lib/api";
import { loadCatalog } from "@/lib/catalog";
import { useResource } from "@/lib/use-resource";

export function BookView() {
  const params = useSearchParams();
  const router = useRouter();
  const centreTestId = params.get("centreTestId");
  const catalog = useResource(loadCatalog, "catalog");
  const [slot, setSlot] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Bumped to reload the slot picker when a slot was taken by someone else meanwhile.
  const [slotsVersion, setSlotsVersion] = useState(0);

  const offering = catalog.data?.offerings.find((o) => String(o.id) === centreTestId);

  async function confirm() {
    if (!offering || !slot) return;
    setSubmitting(true);
    try {
      const booking = await createBooking(offering.id, slot);
      router.push(`/checkout/${booking.id}`);
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't create the booking."));
      if (err instanceof ApiError && err.status === 409) {
        setSlot(null);
        setSlotsVersion((v) => v + 1);
      }
      setSubmitting(false);
    }
  }

  const wrap = (content: ReactNode) => (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{content}</div>
  );
  if (catalog.error) return wrap(<ErrorState message={errorMessage(catalog.error)} onRetry={catalog.reload} />);
  if (!catalog.data) return wrap(<ListSkeleton rows={3} />);
  if (!offering) {
    return wrap(
      <EmptyState
        icon={SearchX}
        title="This test can't be booked right now"
        description="The centre may have stopped offering it. Pick another centre or test."
        action={<Link href="/tests" className={buttonVariants()}>Browse tests</Link>}
      />
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          href={`/tests/${offering.test.id}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> Back to centres
        </Link>
        <BookingSteps current={0} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="min-w-0 rounded-xl border bg-card p-5 sm:p-6">
          <h1 className="text-xl font-semibold">When would you like to visit?</h1>
          <p className="mt-1 mb-6 text-sm text-muted-foreground">
            Sample collection at the centre. Slots are 30 minutes and show how many places are
            left; book at least an hour ahead.
          </p>
          <SlotPicker
            key={slotsVersion}
            centreId={offering.centre.id}
            value={slot}
            onChange={setSlot}
          />
        </section>

        <aside className="lg:sticky lg:top-24 lg:h-fit">
          <OrderSummary
            test={offering.test}
            centre={offering.centre}
            appointment={slot}
            amount={offering.price}
            footer={
              <div className="space-y-3">
                <Button className="h-10 w-full" disabled={!slot || submitting} onClick={confirm}>
                  {submitting && <Loader2 className="animate-spin" />}
                  {slot ? "Continue to payment" : "Select a time slot"}
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  Your slot is held while you pay. You can cancel anytime before the visit.
                </p>
              </div>
            }
          />
        </aside>
      </div>
    </div>
  );
}
