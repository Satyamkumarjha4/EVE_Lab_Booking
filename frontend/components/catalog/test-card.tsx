import { ArrowRight, Building2 } from "lucide-react";
import Link from "next/link";

import type { TestSummary } from "@/lib/catalog";
import { formatINR } from "@/lib/format";
import { categoryOf } from "@/lib/test-categories";

export function TestCard({ summary }: { summary: TestSummary }) {
  const category = categoryOf(summary.test);
  const Icon = category.icon;
  const centreCount = summary.offerings.length;

  return (
    <Link
      href={`/tests/${summary.test.id}`}
      className="group flex flex-col rounded-xl border bg-card p-5 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex size-10 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
          <Icon className="size-5" aria-hidden />
        </span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {category.label}
        </span>
      </div>
      <h3 className="mt-4 font-semibold leading-snug group-hover:text-primary">
        {summary.test.name}
      </h3>
      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{summary.test.description}</p>

      <div className="mt-auto flex items-end justify-between gap-3 pt-5">
        <div>
          <p className="text-xs text-muted-foreground">Starting from</p>
          <p className="text-lg font-semibold">{formatINR(summary.minPrice)}</p>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <p className="flex items-center justify-end gap-1">
            <Building2 className="size-3.5" aria-hidden />
            {centreCount} {centreCount === 1 ? "centre" : "centres"}
          </p>
          <p className="mt-1 flex items-center justify-end gap-1 font-medium text-primary">
            Compare prices <ArrowRight className="size-3.5 transition group-hover:translate-x-0.5" />
          </p>
        </div>
      </div>
    </Link>
  );
}
