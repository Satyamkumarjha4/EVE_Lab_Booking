"use client";

import { Loader2, Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { SelectField } from "@/components/common/select-field";
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
import { Label } from "@/components/ui/label";
import { errorMessage, offerTest } from "@/lib/api";
import { invalidateCatalog } from "@/lib/catalog";
import type { CentreTest, Test } from "@/lib/types";

/** Offer a test from the platform's global catalog at this centre, at this centre's price. */
export function AddTestDialog({
  centreId,
  available,
  onAdded,
}: {
  centreId: number;
  available: Test[];
  onAdded: (item: CentreTest) => void;
}) {
  const [open, setOpen] = useState(false);
  const [testId, setTestId] = useState("");
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);

  function reset(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      setTestId(available[0] ? String(available[0].id) : "");
      setPrice("");
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const item = await offerTest(centreId, Number(testId), Number(price).toFixed(2));
      invalidateCatalog();
      onAdded(item);
      toast.success(`${item.test.name} added at ₹${item.price}`);
      setOpen(false);
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't add the test."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogTrigger render={<Button disabled={available.length === 0} />}>
        <Plus /> Add test
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Offer a new test</DialogTitle>
            <DialogDescription>
              Tests come from the platform catalog. You set this centre&apos;s price.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Test</Label>
            <SelectField
              label="Test"
              value={testId}
              onChange={setTestId}
              options={available.map((t) => ({ value: String(t.id), label: t.name }))}
              className="w-full"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-price">Price (₹)</Label>
            <Input
              id="new-price"
              type="number"
              min="1"
              step="0.01"
              required
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !testId || Number(price) <= 0}>
              {saving && <Loader2 className="animate-spin" />} Add test
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
