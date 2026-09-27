import { CalendarDays, MapPin } from "lucide-react";
import type { ReactNode } from "react";

import { branchName, parseLocation } from "@/lib/catalog";
import { formatDateTime, formatINRPrecise } from "@/lib/format";
import type { Centre, Test } from "@/lib/types";

/** The test/centre/slot/amount card shown beside the booking and checkout steps. */
export function OrderSummary({
  test,
  centre,
  appointment,
  amount,
  footer,
}: {
  test: Test;
  centre: Centre;
  appointment: string | null;
  amount: number | string;
  footer?: ReactNode;
}) {
  const { locality, city } = parseLocation(centre.location);
  return (
    <div className="rounded-xl border bg-card">
      <div className="space-y-4 p-5">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Order summary</p>
        <div>
          <p className="font-semibold">{test.name}</p>
          <p className="text-sm text-muted-foreground">{test.description}</p>
        </div>
        <div className="space-y-2 text-sm">
          <p className="flex gap-2">
            <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            <span>
              <span className="font-medium">{centre.lab.name}</span>, {branchName(centre)}
              <span className="block text-muted-foreground">{locality ? `${locality}, ${city}` : city}</span>
            </span>
          </p>
          <p className="flex gap-2">
            <CalendarDays className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            {appointment ? (
              <span className="font-medium">{formatDateTime(appointment)}</span>
            ) : (
              <span className="text-muted-foreground">Pick a date and time</span>
            )}
          </p>
        </div>
      </div>
      <dl className="space-y-2 border-t p-5 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Test price</dt>
          <dd>{formatINRPrecise(amount)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Booking fee</dt>
          <dd className="text-emerald-700">Free</dd>
        </div>
        <div className="flex justify-between border-t pt-3 text-base font-semibold">
          <dt>Total</dt>
          <dd>{formatINRPrecise(amount)}</dd>
        </div>
      </dl>
      {footer && <div className="border-t p-5">{footer}</div>}
    </div>
  );
}
