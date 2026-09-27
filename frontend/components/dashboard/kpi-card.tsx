import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * A headline number with its change vs the previous period. `delta` is a fraction for relative
 * change, or percentage points when `deltaUnit` is "pts".
 */
export function KpiCard({
  label,
  value,
  icon: Icon,
  delta,
  deltaUnit = "%",
  comparison,
  hint,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  delta?: number | null;
  deltaUnit?: "%" | "pts";
  comparison?: string;
  hint?: string;
}) {
  const hasDelta = delta !== undefined && delta !== null && Number.isFinite(delta);
  const up = hasDelta && delta >= 0;
  const magnitude = hasDelta ? Math.abs(delta * 100).toFixed(1) : "";

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <span className="flex size-8 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
          <Icon className="size-4" aria-hidden />
        </span>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p>
      <div className="mt-1 flex min-h-5 items-center gap-1.5 text-xs">
        {hasDelta ? (
          <>
            <span
              className={cn(
                "inline-flex items-center gap-0.5 font-medium",
                up ? "text-emerald-700" : "text-red-700"
              )}
            >
              {up ? <ArrowUpRight className="size-3.5" aria-hidden /> : <ArrowDownRight className="size-3.5" aria-hidden />}
              {up ? "+" : "−"}
              {magnitude}
              {deltaUnit === "%" ? "%" : " pts"}
            </span>
            {comparison && <span className="text-muted-foreground">{comparison}</span>}
          </>
        ) : (
          hint && <span className="text-muted-foreground">{hint}</span>
        )}
      </div>
    </div>
  );
}
