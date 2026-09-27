"use client";

import { ArrowRight, Building2, CalendarClock, CreditCard, MapPin, Search } from "lucide-react";
import Link from "next/link";

import { TestCard } from "@/components/catalog/test-card";
import { HomeHero } from "@/components/site/home-hero";
import { CardGridSkeleton } from "@/components/common/states";
import { Skeleton } from "@/components/ui/skeleton";
import { buttonVariants } from "@/components/ui/button";
import { loadCatalog, parseLocation } from "@/lib/catalog";
import { CATEGORIES, categoryOf } from "@/lib/test-categories";
import { useResource } from "@/lib/use-resource";
import { cn } from "@/lib/utils";

const STEPS = [
  { icon: Search, title: "Find your test", body: "Search by test or browse by health concern and city." },
  { icon: CalendarClock, title: "Choose a centre & slot", body: "Compare centre prices and pick a time that suits you." },
  { icon: CreditCard, title: "Pay & you're booked", body: "Pay by card or UPI. Your booking is confirmed instantly." },
];

function SectionHeading({ title, href, cta }: { title: string; href: string; cta: string }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      <Link href={href} className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">
        {cta} <ArrowRight className="size-4" />
      </Link>
    </div>
  );
}

export function HomeView() {
  const { data: catalog } = useResource(loadCatalog, "catalog");

  const popular = catalog
    ? [...catalog.tests].sort((a, b) => b.offerings.length - a.offerings.length).slice(0, 6)
    : [];
  const cityCounts = catalog
    ? catalog.cities.map((city) => ({
        city,
        centres: catalog.centres.filter((c) => parseLocation(c.location).city === city).length,
      }))
    : [];
  const stats = catalog && [
    { label: "Tests", value: catalog.tests.length },
    { label: "Centres", value: catalog.centres.length },
    { label: "Cities", value: catalog.cities.length },
    { label: "Partner labs", value: catalog.labs.length },
  ];

  return (
    <>
      <HomeHero cities={catalog?.cities ?? []} />

      <div className="mx-auto max-w-6xl space-y-20 px-4 pb-20 sm:px-6">
        <dl className="grid grid-cols-2 gap-4 rounded-2xl border bg-card p-6 sm:grid-cols-4">
          {stats
            ? stats.map((stat) => (
                <div key={stat.label} className="text-center">
                  <dd className="text-3xl font-semibold text-primary">{stat.value}</dd>
                  <dt className="mt-1 text-sm text-muted-foreground">{stat.label}</dt>
                </div>
              ))
            : Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-16" />)}
        </dl>

        <section className="space-y-6">
          <SectionHeading title="Browse by health concern" href="/tests" cta="All tests" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {CATEGORIES.map((category) => {
              const count = catalog?.tests.filter((t) => categoryOf(t.test).key === category.key).length;
              return (
                <Link
                  key={category.key}
                  href={`/tests?category=${category.key}`}
                  className="group flex items-center gap-3 rounded-xl border bg-card p-4 transition hover:border-primary/40 hover:shadow-sm"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground transition group-hover:bg-primary group-hover:text-primary-foreground">
                    <category.icon className="size-5" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium leading-tight">{category.label}</span>
                    {count !== undefined && <span className="text-xs text-muted-foreground">{count} tests</span>}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="space-y-6">
          <SectionHeading title="Available at the most centres" href="/tests" cta="See all" />
          {catalog ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {popular.map((summary) => (
                <TestCard key={summary.test.id} summary={summary} />
              ))}
            </div>
          ) : (
            <CardGridSkeleton />
          )}
        </section>

        <section className="grid gap-6 rounded-2xl border bg-card p-6 sm:p-10 lg:grid-cols-3">
          <div className="lg:col-span-3">
            <h2 className="text-2xl font-semibold tracking-tight">How it works</h2>
          </div>
          {STEPS.map((step, i) => (
            <div key={step.title} className="flex gap-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <step.icon className="size-5" aria-hidden />
              </span>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Step {i + 1}</p>
                <p className="font-semibold">{step.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
              </div>
            </div>
          ))}
        </section>

        <section className="space-y-6">
          <SectionHeading title="Centres in your city" href="/centres" cta="All centres" />
          <div className="flex flex-wrap gap-3">
            {cityCounts.map(({ city, centres }) => (
              <Link
                key={city}
                href={`/centres?city=${encodeURIComponent(city)}`}
                className="flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm transition hover:border-primary/40"
              >
                <MapPin className="size-4 text-primary" aria-hidden />
                <span className="font-medium">{city}</span>
                <span className="text-muted-foreground">{centres} centres</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="flex flex-col items-start justify-between gap-6 rounded-2xl bg-slate-900 p-8 text-white sm:flex-row sm:items-center sm:p-10">
          <div className="flex gap-4">
            <Building2 className="size-10 shrink-0 text-teal-300" aria-hidden />
            <div>
              <h2 className="text-xl font-semibold">Run a lab or diagnostic centre?</h2>
              <p className="mt-1 max-w-lg text-white/70">
                Track bookings and revenue across centres, manage prices and register walk-in
                patients from one dashboard.
              </p>
            </div>
          </div>
          <Link
            href="/business/login"
            className={cn(buttonVariants({ variant: "secondary" }), "h-10 shrink-0 px-5")}
          >
            Business sign in
          </Link>
        </section>
      </div>
    </>
  );
}
