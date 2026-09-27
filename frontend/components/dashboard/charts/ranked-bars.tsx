import type { Ranked } from "@/lib/analytics";
import { formatINR, plural } from "@/lib/format";

/** Horizontal bars ranked by confirmed revenue, value at the bar tip and volume underneath. */
export function RankedBars({
  title,
  subtitle,
  items,
  empty,
}: {
  title: string;
  subtitle: string;
  items: Ranked[];
  empty: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.revenue));
  return (
    <div className="rounded-xl border bg-card p-5">
      <h2 className="font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground">{subtitle}</p>
      {items.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-5 space-y-4">
          {items.map((item) => (
            <li
              key={item.key}
              title={`${item.label}: ${formatINR(item.revenue)} from ${plural(item.count, "booking")}`}
            >
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate font-medium">{item.label}</span>
                <span className="shrink-0 tabular-nums">{formatINR(item.revenue)}</span>
              </div>
              <div className="mt-1.5 h-2.5 w-full rounded-r bg-muted">
                <div
                  className="h-full rounded-r-[4px] bg-chart-1"
                  style={{ width: `${(item.revenue / max) * 100}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {plural(item.count, "booking")}{item.sublabel ? ` · ${item.sublabel}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
