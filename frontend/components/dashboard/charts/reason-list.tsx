import { plural } from "@/lib/format";

/** Most common reasons behind an outcome, as labelled bars with their counts. */
export function ReasonList({
  title,
  subtitle,
  items,
  empty,
}: {
  title: string;
  subtitle: string;
  items: { label: string; count: number }[];
  empty: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <div className="rounded-xl border bg-card p-5">
      <h2 className="font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground">{subtitle}</p>
      {items.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-5 space-y-3">
          {items.map((item) => (
            <li key={item.label} title={`${item.label}: ${plural(item.count, "booking")}`}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">{item.label}</span>
                <span className="shrink-0 font-medium tabular-nums">{item.count}</span>
              </div>
              <div className="mt-1 h-2 w-full rounded-r bg-muted">
                <div
                  className="h-full rounded-r-[4px] bg-chart-1"
                  style={{ width: `${(item.count / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
