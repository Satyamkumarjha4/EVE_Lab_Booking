import { FlaskConical, MapPin } from "lucide-react";
import Link from "next/link";

import { branchName, parseLocation } from "@/lib/catalog";
import { formatINR } from "@/lib/format";
import type { Centre } from "@/lib/types";

export function CentreCard({
  centre,
  testCount,
  minPrice,
}: {
  centre: Centre;
  testCount: number;
  minPrice: number | null;
}) {
  const { locality, city } = parseLocation(centre.location);
  return (
    <Link
      href={`/centres/${centre.id}`}
      className="group flex flex-col rounded-xl border bg-card p-5 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
    >
      <p className="text-xs font-medium tracking-wide text-primary uppercase">{centre.lab.name}</p>
      <h3 className="mt-1 text-lg font-semibold group-hover:text-primary">{branchName(centre)}</h3>
      <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
        <MapPin className="size-4 shrink-0" aria-hidden />
        {locality ? `${locality}, ${city}` : city}
      </p>
      <div className="mt-auto flex items-center justify-between border-t pt-4 text-sm">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <FlaskConical className="size-4" aria-hidden />
          {testCount} tests available
        </span>
        {minPrice !== null && (
          <span className="text-muted-foreground">
            from <span className="font-semibold text-foreground">{formatINR(minPrice)}</span>
          </span>
        )}
      </div>
    </Link>
  );
}
