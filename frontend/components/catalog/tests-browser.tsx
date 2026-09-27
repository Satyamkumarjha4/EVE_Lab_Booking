"use client";

import { FlaskConical, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";

import { TestCard } from "@/components/catalog/test-card";
import { PageHeader } from "@/components/common/page-header";
import { SearchInput } from "@/components/common/search-input";
import { SelectField } from "@/components/common/select-field";
import { CardGridSkeleton, EmptyState, ErrorState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/api";
import { loadCatalog } from "@/lib/catalog";
import {
  ALL,
  cityOptions,
  filterTests,
  labOptions,
  TEST_FILTER_DEFAULTS,
  TEST_SORTS,
} from "@/lib/catalog-filters";
import { CATEGORIES, categoryOf } from "@/lib/test-categories";
import { useResource } from "@/lib/use-resource";
import { useUrlFilters } from "@/lib/use-url-filters";
import { cn } from "@/lib/utils";

export function TestsBrowser() {
  const catalog = useResource(loadCatalog, "catalog");
  const [filters, setFilters] = useUrlFilters(TEST_FILTER_DEFAULTS);
  const [searchKey, setSearchKey] = useState(0);

  const results = useMemo(
    () => (catalog.data ? filterTests(catalog.data, filters) : []),
    [catalog.data, filters]
  );
  // Category counts ignore the category filter itself, so every chip shows what it would give.
  const categoryCounts = useMemo(() => {
    if (!catalog.data) return new Map<string, number>();
    const counts = new Map<string, number>();
    for (const s of filterTests(catalog.data, { ...filters, category: ALL })) {
      const key = categoryOf(s.test).key;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [catalog.data, filters]);

  const filtered = Object.entries(TEST_FILTER_DEFAULTS).some(
    ([key, value]) => key !== "sort" && filters[key as keyof typeof filters] !== value
  );

  function clearFilters() {
    setFilters({ q: "", city: ALL, lab: ALL, category: ALL });
    setSearchKey((k) => k + 1);
  }

  const cityName = filters.city !== ALL ? ` in ${filters.city}` : "";

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title={`Find a lab test${cityName}`}
        description="Prices are set by each centre. Pick a test to compare centres and book a slot."
      />

      <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Test categories">
        {[{ key: ALL, label: "All tests" }, ...CATEGORIES].map((category) => {
          const active = filters.category === category.key;
          const count =
            category.key === ALL
              ? [...categoryCounts.values()].reduce((a, b) => a + b, 0)
              : categoryCounts.get(category.key) ?? 0;
          return (
            <button
              key={category.key}
              type="button"
              aria-pressed={active}
              onClick={() => setFilters({ category: category.key })}
              className={cn(
                "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
              )}
            >
              {category.label}
              {catalog.data && <span className="ml-1.5 opacity-70">{count}</span>}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 md:flex-row md:items-center">
        <SearchInput
          key={searchKey}
          defaultValue={filters.q}
          onSearch={(q) => setFilters({ q })}
          placeholder="Search tests, e.g. thyroid, CBC, vitamin"
          className="flex-1"
        />
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <SelectField
            label="City"
            value={filters.city}
            onChange={(city) => setFilters({ city })}
            options={cityOptions(catalog.data?.cities ?? [])}
            className="w-full sm:w-40"
          />
          <SelectField
            label="Lab"
            value={filters.lab}
            onChange={(lab) => setFilters({ lab })}
            options={labOptions(catalog.data?.labs ?? [])}
            className="w-full sm:w-48"
          />
          <SelectField
            label="Sort by"
            value={filters.sort}
            onChange={(sort) => setFilters({ sort })}
            options={TEST_SORTS}
            className="col-span-2 w-full sm:w-48"
          />
        </div>
      </div>

      {catalog.error ? (
        <ErrorState message={errorMessage(catalog.error, "Couldn't load tests.")} onRetry={catalog.reload} />
      ) : !catalog.data ? (
        <CardGridSkeleton />
      ) : results.length === 0 ? (
        <EmptyState
          icon={FlaskConical}
          title="No tests match these filters"
          description="Try a different search term, city or category."
          action={
            <Button variant="outline" onClick={clearFilters}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">{results.length}</span>{" "}
              {results.length === 1 ? "test" : "tests"} found
            </p>
            {filtered && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <SlidersHorizontal /> Reset filters
              </Button>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((summary) => (
              <TestCard key={summary.test.id} summary={summary} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
