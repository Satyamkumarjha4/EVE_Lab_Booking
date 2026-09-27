"use client";

import { Loader2 } from "lucide-react";
import { useState, type FormEvent, type ReactElement } from "react";
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
import { createSlotRule, errorMessage, updateSlotRule, type SlotRuleInput } from "@/lib/api";
import { clockLabel } from "@/lib/slots";
import type { SlotRule } from "@/lib/types";

/** Every half hour of the day as "HH:MM", the only times a rule can start or end on. */
const TIMES = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, "0");
  return `${h}:${i % 2 ? "30" : "00"}`;
});
const TIME_OPTIONS = TIMES.map((t) => ({ value: t, label: clockLabel(t) }));

/**
 * Add or edit one time range of a centre's schedule. `scope` fixes whether it belongs to a
 * weekday of the regular week or to one date (an override).
 */
export function RuleDialog({
  centreId,
  scope,
  scopeLabel,
  rule,
  trigger,
  onSaved,
}: {
  centreId: number;
  scope: { weekday: number } | { date: string };
  scopeLabel: string;
  rule?: SlotRule;
  trigger: ReactElement;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("13:00");
  const [capacity, setCapacity] = useState("4");
  const [saving, setSaving] = useState(false);

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setStart(rule ? rule.start_time.slice(0, 5) : "09:00");
      setEnd(rule ? rule.end_time.slice(0, 5) : "13:00");
      setCapacity(rule ? String(rule.capacity) : "4");
    }
  }

  const valid = end > start && Number(capacity) >= 0 && Number(capacity) <= 50;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const body: SlotRuleInput = {
      weekday: "weekday" in scope ? scope.weekday : null,
      date: "date" in scope ? scope.date : null,
      start_time: start,
      end_time: end,
      capacity: Number(capacity),
    };
    try {
      if (rule) await updateSlotRule(centreId, rule.id, body);
      else await createSlotRule(centreId, body);
      toast.success("Schedule updated");
      onSaved();
      setOpen(false);
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't save this time range."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{rule ? "Edit time range" : "Add time range"}</DialogTitle>
            <DialogDescription>
              {scopeLabel}. Each 30-minute slot in the range takes this many patients.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>From</Label>
              <SelectField label="From" value={start} onChange={setStart} options={TIME_OPTIONS} className="w-full" />
            </div>
            <div className="space-y-1.5">
              <Label>Until</Label>
              <SelectField label="Until" value={end} onChange={setEnd} options={TIME_OPTIONS} className="w-full" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="capacity">Patients per slot</Label>
            <Input
              id="capacity"
              type="number"
              min="0"
              max="50"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">0 closes these slots.</p>
          </div>
          {end <= start && <p className="text-sm text-red-700">&ldquo;Until&rdquo; must be after &ldquo;From&rdquo;.</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!valid || saving}>
              {saving && <Loader2 className="animate-spin" />} Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
