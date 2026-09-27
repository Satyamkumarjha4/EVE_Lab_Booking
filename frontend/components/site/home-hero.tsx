"use client";

import { MapPin, Search, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { SelectField } from "@/components/common/select-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ALL, cityOptions } from "@/lib/catalog-filters";

const QUICK_SEARCHES = ["Thyroid", "Vitamin D", "Lipid Profile", "HbA1c", "CBC"];

export function HomeHero({ cities }: { cities: string[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [city, setCity] = useState(ALL);

  function search(q: string, e?: FormEvent) {
    e?.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (city !== ALL) params.set("city", city);
    router.push(`/tests${params.size ? `?${params}` : ""}`);
  }

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-teal-50 via-background to-background">
      <div aria-hidden className="absolute -top-40 left-1/2 size-[40rem] -translate-x-1/2 rounded-full bg-teal-100/60 blur-3xl" />
      <div className="relative mx-auto max-w-6xl px-4 pt-16 pb-14 sm:px-6 sm:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mx-auto inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <ShieldCheck className="size-3.5 text-primary" aria-hidden />
            Accredited labs · Transparent centre pricing
          </p>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Book lab tests near you, <span className="text-primary">at the best price</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
            Compare the same test across diagnostic centres in your city, pick a slot and pay
            online in a couple of minutes.
          </p>
        </div>

        <form
          onSubmit={(e) => search(query, e)}
          className="mx-auto mt-10 flex max-w-3xl flex-col gap-2 rounded-2xl border bg-card p-2 shadow-lg shadow-teal-900/5 sm:flex-row"
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              aria-label="Search for a test"
              placeholder="Search for a test, e.g. Thyroid Profile"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-12 border-0 pl-11 text-base shadow-none focus-visible:ring-0"
            />
          </div>
          <div className="flex items-center gap-2 border-t pt-2 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-2">
            <MapPin className="ml-2 size-5 shrink-0 text-muted-foreground" aria-hidden />
            <SelectField
              label="City"
              value={city}
              onChange={setCity}
              options={cityOptions(cities)}
              className="h-12 w-full border-0 bg-transparent sm:w-40"
            />
          </div>
          <Button type="submit" className="h-12 px-6 text-base">
            Search
          </Button>
        </form>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-sm">
          <span className="text-muted-foreground">Popular:</span>
          {QUICK_SEARCHES.map((term) => (
            <button
              key={term}
              type="button"
              onClick={() => search(term)}
              className="rounded-full border bg-card px-3 py-1 text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
            >
              {term}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
