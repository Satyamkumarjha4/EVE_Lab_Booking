"use client";

import { Building2, ChevronLeft, FlaskConical, MapPin } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";

import { SearchInput } from "@/components/common/search-input";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/common/states";
import { buttonVariants } from "@/components/ui/button";
import { errorMessage } from "@/lib/api";
import { branchName, loadCatalog, parseLocation } from "@/lib/catalog";
import { formatINR } from "@/lib/format";
import { CATEGORIES, categoryOf } from "@/lib/test-categories";
import { useResource } from "@/lib/use-resource";

export function CentreDetail() {
  const { centreId } = useParams<{ centreId: string }>();
  const catalog = useResource(loadCatalog, "catalog");
  const [query, setQuery] = useState("");

  const centre = catalog.data?.centres.find((c) => String(c.id) === centreId);
  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    const offerings = (catalog.data?.offerings ?? []).filter(
      (o) => String(o.centre.id) === centreId && (!q || o.test.name.toLowerCase().includes(q))
    );
    return CATEGORIES.map((category) => ({
      category,
      offerings: offerings
        .filter((o) => categoryOf(o.test).key === category.key)
        .sort((a, b) => a.test.name.localeCompare(b.test.name)),
    })).filter((section) => section.offerings.length > 0);
  }, [catalog.data, centreId, query]);

  const wrap = (content: ReactNode) => (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{content}</div>
  );
  if (catalog.error) return wrap(<ErrorState message={errorMessage(catalog.error)} onRetry={catalog.reload} />);
  if (!catalog.data) return wrap(<ListSkeleton />);
  if (!centre) {
    return wrap(
      <EmptyState
        icon={Building2}
        title="Centre not found"
        action={<Link href="/centres" className={buttonVariants()}>All centres</Link>}
      />
    );
  }

  const { locality, city } = parseLocation(centre.location);
  const total = catalog.data.offerings.filter((o) => o.centre.id === centre.id).length;

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
      <Link href="/centres" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> All centres
      </Link>

      <section className="relative overflow-hidden rounded-2xl bg-teal-800 p-6 text-white sm:p-8">
        <div aria-hidden className="absolute -top-20 -right-20 size-64 rounded-full bg-white/5" />
        <p className="text-sm font-medium text-teal-200">{centre.lab.name}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{branchName(centre)}</h1>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/85">
          <span className="flex items-center gap-1.5">
            <MapPin className="size-4" aria-hidden /> {locality ? `${locality}, ${city}` : city}
          </span>
          <span className="flex items-center gap-1.5">
            <FlaskConical className="size-4" aria-hidden /> {total} tests available
          </span>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Tests at this centre</h2>
        <SearchInput defaultValue="" onSearch={setQuery} placeholder="Search tests here" className="w-full sm:w-72" />
      </div>

      {sections.length === 0 ? (
        <EmptyState icon={FlaskConical} title={query ? "No tests match your search" : "No tests offered yet"} />
      ) : (
        <div className="space-y-6">
          {sections.map(({ category, offerings }) => (
            <section key={category.key} className="overflow-hidden rounded-xl border bg-card">
              <h3 className="flex items-center gap-2 border-b bg-muted/40 px-4 py-2.5 text-sm font-semibold">
                <category.icon className="size-4 text-primary" aria-hidden />
                {category.label}
              </h3>
              <ul className="divide-y">
                {offerings.map((offering) => (
                  <li key={offering.id} className="flex items-center gap-4 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <Link href={`/tests/${offering.test.id}`} className="font-medium hover:underline">
                        {offering.test.name}
                      </Link>
                      <p className="truncate text-sm text-muted-foreground">{offering.test.description}</p>
                    </div>
                    <p className="font-semibold">{formatINR(offering.price)}</p>
                    <Link href={`/book?centreTestId=${offering.id}`} className={buttonVariants({ size: "sm" })}>
                      Book
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
