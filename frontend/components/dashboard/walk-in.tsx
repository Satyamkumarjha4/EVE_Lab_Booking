"use client";

import { Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { OrderSummary } from "@/components/booking/order-summary";
import { SlotPicker } from "@/components/booking/slot-picker";
import { PageHeader } from "@/components/common/page-header";
import { SearchInput } from "@/components/common/search-input";
import { ErrorState, ListSkeleton } from "@/components/common/states";
import { useDashboard } from "@/components/dashboard/dashboard-context";
import { PatientStep } from "@/components/dashboard/patient-step";
import { Button } from "@/components/ui/button";
import { ApiError, createBooking, errorMessage, listCentreTests } from "@/lib/api";
import { formatINR } from "@/lib/format";
import type { CentreTest, Patient } from "@/lib/types";
import { useResource } from "@/lib/use-resource";
import { cn } from "@/lib/utils";

/** Centre staff register a patient at the desk, then collect payment on the booking page. */
export function WalkIn() {
  const { user, centres } = useDashboard();
  const router = useRouter();
  const centreId = user.centre ?? 0;
  const tests = useResource(() => listCentreTests(centreId), `centre-tests:${centreId}`);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<CentreTest | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [slotsVersion, setSlotsVersion] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const centre = centres?.find((c) => c.id === centreId);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (tests.data ?? []).filter((t) => !q || t.test.name.toLowerCase().includes(q));
  }, [tests.data, query]);

  async function submit() {
    if (!selected || !slot || !patient) return;
    setSubmitting(true);
    try {
      const booking = await createBooking(selected.id, slot, patient.id);
      toast.success("Walk-in booking created. Collect payment to confirm it.");
      router.push(`/dashboard/bookings/${booking.id}`);
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't create the booking."));
      if (err instanceof ApiError && err.status === 409) {
        setSlot(null);
        setSlotsVersion((v) => v + 1);
      }
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Walk-in booking"
        description="Book a patient in at the desk: identify them, choose the test and slot, then take payment."
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-6">
          <section className="rounded-xl border bg-card p-5">
            <h2 className="mb-4 font-semibold">1. Patient</h2>
            <PatientStep patient={patient} onSelect={setPatient} />
          </section>

          <section className="rounded-xl border bg-card p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold">2. Test</h2>
              <SearchInput defaultValue="" onSearch={setQuery} placeholder="Search tests" className="w-full sm:w-64" />
            </div>
            {tests.error ? (
              <ErrorState message={errorMessage(tests.error)} onRetry={tests.reload} />
            ) : !tests.data ? (
              <ListSkeleton rows={4} />
            ) : (
              <div className="grid max-h-80 gap-2 overflow-y-auto pr-1 sm:grid-cols-2" role="radiogroup" aria-label="Test">
                {visible.map((ct) => {
                  const active = selected?.id === ct.id;
                  return (
                    <button
                      key={ct.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setSelected(ct)}
                      className={cn(
                        "flex items-center justify-between gap-3 rounded-lg border p-3 text-left text-sm transition",
                        active ? "border-primary bg-secondary" : "hover:border-primary/40"
                      )}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{ct.test.name}</span>
                        <span className="text-muted-foreground">{formatINR(ct.price)}</span>
                      </span>
                      {active && <Check className="size-4 shrink-0 text-primary" aria-hidden />}
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section className={cn("rounded-xl border bg-card p-5", !selected && "opacity-60")}>
            <h2 className="mb-4 font-semibold">3. Slot</h2>
            {selected ? (
              <SlotPicker key={slotsVersion} centreId={centreId} value={slot} onChange={setSlot} />
            ) : (
              <p className="text-sm text-muted-foreground">Choose a test first.</p>
            )}
          </section>
        </div>

        <aside className="lg:sticky lg:top-20 lg:h-fit">
          {selected && centre ? (
            <OrderSummary
              test={selected.test}
              centre={centre}
              appointment={slot}
              amount={selected.price}
              footer={
                <div className="space-y-2">
                  <Button
                    className="h-10 w-full"
                    disabled={!slot || !patient || submitting}
                    onClick={submit}
                  >
                    {submitting && <Loader2 className="animate-spin" />}
                    Create booking
                  </Button>
                  {!patient && (
                    <p className="text-center text-xs text-muted-foreground">
                      Identify the patient first.
                    </p>
                  )}
                </div>
              }
            />
          ) : (
            <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              The order summary appears once a test is selected.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
