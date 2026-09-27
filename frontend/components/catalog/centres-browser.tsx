"use client";

import { Building2, MapPin } from "lucide-react";
import { useMemo, useState } from "react";

import { CentreCard } from "@/components/catalog/centre-card";
import { PageHeader } from "@/components/common/page-header";
import { SearchInput } from "@/components/common/search-input";
import { SelectField } from "@/components/common/select-field";
import { CardGridSkeleton, EmptyState, ErrorState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/api";
import { loadCatalog, parseLocation } from "@/lib/catalog";
import {
  ALL,
  CENTRE_FILTER_DEFAULTS,
  cityOptions,
  filterCentres,
  labOptions,
} from "@/lib/catalog-filters";
import { useResource } from "@/lib/use-resource";
import { useUrlFilters } from "@/lib/use-url-filters";

export function CentresBrowser() {
  const catalog = useResource(loadCatalog, "catalog");
  const [filters, setFilters] = useUrlFilters(CENTRE_FILTER_DEFAULTS);
  const [searchKey, setSearchKey] = useState(0);

  const listings = useMemo(
    () => (catalog.data ? filterCentres(catalog.data, filters) : []),
    [catalog.data, filters]
  );
  // Group by city so the directory reads like "centres near me".
  const byCity = useMemo(() => {
    const groups = new Map<string, typeof listings>();
    for (const listing of listings) {
      const city = parseLocation(listing.centre.location).city;
      groups.set(city, [...(groups.get(city) ?? []), listing]);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [listings]);

  function clearFilters() {
    setFilters({ q: "", city: ALL, lab: ALL });
    setSearchKey((k) => k + 1);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title="Diagnostic centres"
        description="Find a centre near you and see every test it offers, with its prices."
      />

      <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 md:flex-row md:items-center">
        <SearchInput
          key={searchKey}
          defaultValue={filters.q}
          onSearch={(q) => setFilters({ q })}
          placeholder="Search by area or centre, e.g. Bandra"
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
        </div>
      </div>

      {catalog.error ? (
        <ErrorState message={errorMessage(catalog.error, "Couldn't load centres.")} onRetry={catalog.reload} />
      ) : !catalog.data ? (
        <CardGridSkeleton />
      ) : listings.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No centres match"
          description="Try another area, city or lab."
          action={<Button variant="outline" onClick={clearFilters}>Clear filters</Button>}
        />
      ) : (
        <div className="space-y-10">
          {byCity.map(([city, cityListings]) => (
            <section key={city} className="space-y-4">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <MapPin className="size-5 text-primary" aria-hidden />
                {city}
                <span className="text-sm font-normal text-muted-foreground">
                  {cityListings.length} {cityListings.length === 1 ? "centre" : "centres"}
                </span>
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {cityListings.map((listing) => (
                  <CentreCard key={listing.centre.id} {...listing} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
