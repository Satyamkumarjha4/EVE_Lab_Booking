import type { statusBreakdown } from "@/lib/analytics";
import { formatPercent } from "@/lib/format";
import { STATUS_META } from "@/lib/status";

/**
 * Share of bookings per status as one 100% bar plus a labelled list. Status colors are reserved
 * and always paired with an icon, label and count, so color never carries the meaning alone.
 */
export function StatusBreakdown({ data }: { data: ReturnType<typeof statusBreakdown> }) {
  const total = data.reduce((sum, d) => sum + d.count, 0);
  return (
    <div className="rounded-xl border bg-card p-5">
      <h2 className="font-semibold">Booking outcomes</h2>
      <p className="text-sm text-muted-foreground">{total} bookings in this period</p>

      <div className="mt-5 flex h-3 w-full gap-0.5 overflow-hidden rounded-[4px] bg-muted" aria-hidden>
        {data
          .filter((d) => d.count > 0)
          .map((d) => (
            <div
              key={d.status}
              title={`${STATUS_META[d.status].label}: ${d.count}`}
              style={{ width: `${d.share * 100}%`, backgroundColor: STATUS_META[d.status].color }}
            />
          ))}
      </div>

      <ul className="mt-5 space-y-3">
        {data.map((d) => {
          const meta = STATUS_META[d.status];
          return (
            <li key={d.status} className="flex items-center gap-3 text-sm">
              <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: meta.color }} aria-hidden />
              <meta.icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="flex-1">{meta.label}</span>
              <span className="font-medium tabular-nums">{d.count}</span>
              <span className="w-12 text-right text-muted-foreground tabular-nums">{formatPercent(d.share)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
