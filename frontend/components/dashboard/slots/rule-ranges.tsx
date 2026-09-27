"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { deleteSlotRule, errorMessage } from "@/lib/api";
import { clockLabel } from "@/lib/slots";
import type { SlotRule } from "@/lib/types";

import { RuleDialog } from "./rule-dialog";

/** The time ranges of one weekday or date, with add/edit/delete when editable. */
export function RuleRanges({
  centreId,
  rules,
  scope,
  scopeLabel,
  readOnly,
  onChange,
}: {
  centreId: number;
  rules: SlotRule[];
  scope: { weekday: number } | { date: string };
  scopeLabel: string;
  readOnly: boolean;
  onChange: () => void;
}) {
  async function remove(rule: SlotRule) {
    try {
      await deleteSlotRule(centreId, rule.id);
      toast.success("Time range removed");
      onChange();
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't remove the time range."));
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {rules.length === 0 && <span className="text-sm text-muted-foreground">Closed</span>}
      {rules.map((rule) => (
        <span
          key={rule.id}
          className="inline-flex items-center gap-1 rounded-lg border bg-card py-1 pr-1 pl-2.5 text-sm"
        >
          <span className="tabular-nums">
            {clockLabel(rule.start_time)} – {clockLabel(rule.end_time)}
          </span>
          <span className={rule.capacity === 0 ? "text-red-700" : "text-muted-foreground"}>
            · {rule.capacity === 0 ? "closed" : `${rule.capacity} per slot`}
          </span>
          {!readOnly && (
            <>
              <RuleDialog
                centreId={centreId}
                scope={scope}
                scopeLabel={scopeLabel}
                rule={rule}
                onSaved={onChange}
                trigger={
                  <Button variant="ghost" size="icon-xs" aria-label="Edit time range">
                    <Pencil />
                  </Button>
                }
              />
              <Button variant="ghost" size="icon-xs" aria-label="Remove time range" onClick={() => remove(rule)}>
                <Trash2 />
              </Button>
            </>
          )}
        </span>
      ))}
      {!readOnly && (
        <RuleDialog
          centreId={centreId}
          scope={scope}
          scopeLabel={scopeLabel}
          onSaved={onChange}
          trigger={
            <Button variant="outline" size="xs">
              <Plus /> Add range
            </Button>
          }
        />
      )}
    </div>
  );
}
