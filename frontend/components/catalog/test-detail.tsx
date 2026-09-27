"use client";

import { ChevronLeft, Clock, IdCard, MapPin, SearchX, Utensils } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";

import { SelectField } from "@/components/common/select-field";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/common/states";
import { buttonVariants } from "@/components/ui/button";
import { errorMessage } from "@/lib/api";
import { branchName, loadCatalog, parseLocation } from "@/lib/catalog";
import { ALL, cityOptions } from "@/lib/catalog-filters";
import { formatINR } from "@/lib/format";
import { categoryOf } from "@/lib/test-categories";
import { useResource } from "@/lib/use-resource";

const FASTING_HINTS = ["fasting", "lipid", "glucose"];

export function TestDetail() {
  const { testId } = useParams<{ testId: string }>();
  const catalog = useResource(loadCatalog, "catalog");
  const [city, setCity] = useState(ALL);
  const [sort, setSort] = useState<"price" | "name">("price");

  const summary = catalog.data?.tests.find((t) => String(t.test.id) === testId);
  const cities = useMemo(
    () => [...new Set(summary?.offerings.map((o) => parseLocation(o.centre.location).city))].sort(),
    [summary]
  );
  const offerings = useMemo(() => {
    const list = (summary?.offerings ?? []).filter(
      (o) => city === ALL || parseLocation(o.centre.location).city === city
    );
    return list.sort((a, b) =>
      sort === "price" ? a.price - b.price : a.centre.name.localeCompare(b.centre.name)
    );
  }, [summary, city, sort]);

  if (catalog.error) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <ErrorState message={errorMessage(catalog.error)} onRetry={catalog.reload} />
      </div>
    );
  }
  if (!catalog.data) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <ListSkeleton />
      </div>
    );
  }
  if (!summary) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <EmptyState
          icon={SearchX}
          title="This test isn't available right now"
          description="No centre currently offers it. Browse other tests instead."
          action={<Link href="/tests" className={buttonVariants()}>Browse tests</Link>}
        />
      </div>
    );
  }

  const category = categoryOf(summary.test);
  const Icon = category.icon;
  const needsFasting = FASTING_HINTS.some((h) => summary.test.name.toLowerCase().includes(h));
  const lowest = offerings.length ? Math.min(...offerings.map((o) => o.price)) : null;

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
      <Link href="/tests" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> All tests
      </Link>

      <section className="flex flex-col gap-6 rounded-2xl border bg-card p-6 md:flex-row md:items-center">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
          <Icon className="size-7" aria-hidden />
        </span>
        <div className="flex-1 space-y-1">
          <p className="text-sm text-primary">{category.label}</p>
          <h1 className="text-2xl font-semibold tracking-tight">{summary.test.name}</h1>
          <p className="text-muted-foreground">{summary.test.description}</p>
        </div>
        <div className="shrink-0 rounded-xl bg-muted/60 px-5 py-4 md:text-right">
          <p className="text-xs text-muted-foreground">Price range</p>
          <p className="text-xl font-semibold">
            {formatINR(summary.minPrice)}
            {summary.maxPrice > summary.minPrice && ` – ${formatINR(summary.maxPrice)}`}
          </p>
          <p className="text-xs text-muted-foreground">at {summary.offerings.length} centres</p>
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Compare centres</h2>
            <div className="flex gap-2">
              <SelectField label="City" value={city} onChange={setCity} options={cityOptions(cities)} className="w-40" />
              <SelectField
                label="Sort centres"
                value={sort}
                onChange={setSort}
                options={[
                  { value: "price", label: "Lowest price" },
                  { value: "name", label: "Centre name" },
                ]}
                className="w-40"
              />
            </div>
          </div>
          <ul className="divide-y rounded-xl border bg-card">
            {offerings.map((offering) => {
              const { locality, city: centreCity } = parseLocation(offering.centre.location);
              return (
                <li key={offering.id} className="flex flex-wrap items-center gap-4 p-4 sm:flex-nowrap">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-primary">{offering.centre.lab.name}</p>
                    <Link href={`/centres/${offering.centre.id}`} className="font-medium hover:underline">
                      {branchName(offering.centre)}
                    </Link>
                    <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="size-3.5" aria-hidden />
                      {locality ? `${locality}, ${centreCity}` : centreCity}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold">{formatINR(offering.price)}</p>
                    {offering.price === lowest && offerings.length > 1 && (
                      <p className="text-xs font-medium text-emerald-700">Lowest price</p>
                    )}
                  </div>
                  <Link href={`/book?centreTestId=${offering.id}`} className={buttonVariants()}>
                    Book
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        <aside className="h-fit space-y-4 rounded-xl border bg-card p-5">
          <h2 className="font-semibold">Before your visit</h2>
          <ul className="space-y-3 text-sm text-muted-foreground">
            {needsFasting && (
              <li className="flex gap-3">
                <Utensils className="size-4 shrink-0 text-primary" aria-hidden />
                Usually needs 8–12 hours of fasting. Water is fine.
              </li>
            )}
            <li className="flex gap-3">
              <IdCard className="size-4 shrink-0 text-primary" aria-hidden />
              Carry a photo ID and your booking reference.
            </li>
            <li className="flex gap-3">
              <Clock className="size-4 shrink-0 text-primary" aria-hidden />
              Arrive 10 minutes before your slot.
            </li>
          </ul>
        </aside>
      </div>
    </div>
  );
}
