"use client";

import { Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { TableCell, TableRow } from "@/components/ui/table";
import { errorMessage, updateCentreTest } from "@/lib/api";
import { invalidateCatalog } from "@/lib/catalog";
import { formatINR, formatINRPrecise } from "@/lib/format";
import { categoryOf } from "@/lib/test-categories";
import type { CentreTest } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface MarketStat {
  avg: number;
  /** No other lab offers this test, so the average is this lab's own price. */
  onlyYou: boolean;
}

/**
 * One offered test at a centre. The lab edits its price and sees the market average; centre staff
 * see the price read-only. Both switch availability and see upcoming bookings for the test.
 */
export function PriceRow({
  centreId,
  item,
  editablePrice,
  market,
  upcoming,
  onChange,
}: {
  centreId: number;
  item: CentreTest;
  editablePrice: boolean;
  /** Omitted for centre staff: the market comparison is the lab's concern. */
  market?: MarketStat | null;
  upcoming: string;
  onChange: (item: CentreTest) => void;
}) {
  const [price, setPrice] = useState(item.price);
  const [saving, setSaving] = useState<"price" | "active" | null>(null);
  const numeric = Number(price);
  const dirty = price !== item.price && numeric > 0;

  async function save(changes: { price?: string; is_active?: boolean }, kind: "price" | "active") {
    setSaving(kind);
    try {
      const updated = await updateCentreTest(centreId, item.id, changes);
      invalidateCatalog();
      onChange(updated);
      setPrice(updated.price);
      toast.success(
        kind === "price"
          ? `${item.test.name} is now ${formatINR(updated.price)}`
          : `${item.test.name} ${updated.is_active ? "is bookable again" : "is hidden from patients"}`
      );
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't save the change."));
    } finally {
      setSaving(null);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (dirty) save({ price: numeric.toFixed(2) }, "price");
  }

  const diff = market && !market.onlyYou ? (Number(item.price) - market.avg) / market.avg : null;

  return (
    <TableRow className={cn(!item.is_active && "bg-muted/30")}>
      <TableCell className="pl-4">
        <p className={cn("font-medium", !item.is_active && "text-muted-foreground")}>{item.test.name}</p>
        <p className="text-xs text-muted-foreground">{categoryOf(item.test).label}</p>
      </TableCell>
      <TableCell>
        {editablePrice ? (
          <form onSubmit={onSubmit} className="flex items-center gap-2">
            <div className="relative w-28">
              <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
              <Input
                aria-label={`Price for ${item.test.name}`}
                type="number"
                min="1"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="h-8 pl-6 tabular-nums"
              />
            </div>
            {dirty && (
              <Button type="submit" size="sm" disabled={saving !== null}>
                {saving === "price" && <Loader2 className="animate-spin" />} Save
              </Button>
            )}
          </form>
        ) : (
          <span className="font-medium tabular-nums">{formatINRPrecise(item.price)}</span>
        )}
      </TableCell>
      {market !== undefined && (
        <TableCell className="hidden md:table-cell">
          {market ? (
            <div className="text-sm">
              <p className="tabular-nums">{formatINR(market.avg)}</p>
              {market.onlyYou ? (
                <p className="text-xs text-muted-foreground">Only your lab offers this</p>
              ) : (
                diff !== null &&
                Math.abs(diff) >= 0.005 && (
                  <p className={cn("text-xs", diff > 0 ? "text-amber-700" : "text-emerald-700")}>
                    {diff > 0 ? "▲" : "▼"} {Math.abs(diff * 100).toFixed(0)}% {diff > 0 ? "above" : "below"}
                  </p>
                )
              )}
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          )}
        </TableCell>
      )}
      <TableCell className="text-sm tabular-nums">{upcoming}</TableCell>
      <TableCell className="pr-4">
        <label className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
          <span className="hidden sm:inline">{item.is_active ? "Bookable" : "Hidden"}</span>
          <Switch
            checked={item.is_active}
            disabled={saving !== null}
            onCheckedChange={(checked) => save({ is_active: checked }, "active")}
            aria-label={`${item.test.name} bookable`}
          />
        </label>
      </TableCell>
    </TableRow>
  );
}
