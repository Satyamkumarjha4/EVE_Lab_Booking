"use client";

import { Loader2, Percent } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { errorMessage, getMyLab, updateMyLab } from "@/lib/api";
import { invalidateCatalog } from "@/lib/catalog";
import { useResource } from "@/lib/use-resource";

/** The lab's transaction fee: kept when a patient cancels a paid booking or doesn't turn up. */
export function LabPolicyCard({ onSaved }: { onSaved: () => void }) {
  const lab = useResource(getMyLab, "lab-settings");
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const saved = lab.data ? String(Number(lab.data.transaction_fee_percent)) : "";
  const value = draft ?? saved;
  const numeric = Number(value);
  const valid = value !== "" && numeric >= 0 && numeric <= 100;

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await updateMyLab({ transaction_fee_percent: numeric.toFixed(2) });
      lab.setData(() => updated);
      setDraft(null);
      invalidateCatalog();
      onSaved();
      toast.success(`Transaction fee set to ${numeric}%`);
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't save the fee."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card p-5 md:flex-row md:items-center md:justify-between">
      <div className="max-w-xl">
        <h2 className="font-semibold">Transaction fee</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Kept when a patient cancels a paid booking or doesn&apos;t arrive; the rest is refunded.
          Bookings the lab cancels are always refunded in full. Applies to all your centres.
        </p>
      </div>
      <form onSubmit={save} className="flex items-center gap-2">
        <div className="relative w-28">
          <Input
            aria-label="Transaction fee percent"
            type="number"
            min="0"
            max="100"
            step="0.5"
            disabled={!lab.data}
            value={value}
            onChange={(e) => setDraft(e.target.value)}
            className="h-9 pr-8 tabular-nums"
          />
          <Percent className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        </div>
        <Button type="submit" disabled={!valid || value === saved || saving}>
          {saving && <Loader2 className="animate-spin" />} Save
        </Button>
      </form>
    </section>
  );
}
