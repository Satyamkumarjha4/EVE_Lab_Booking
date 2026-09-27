"use client";

import { ChevronLeft, MapPin, SearchX } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { EmptyState, ListSkeleton } from "@/components/common/states";
import { BookingsManager } from "@/components/dashboard/bookings-manager";
import { useDashboard } from "@/components/dashboard/dashboard-context";
import { SlotManager } from "@/components/dashboard/slots/slot-manager";
import { buttonVariants } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { centreSnapshot } from "@/lib/analytics";
import { listBookings } from "@/lib/api";
import { branchName, parseLocation } from "@/lib/catalog";
import { formatINR, formatPercent } from "@/lib/format";
import { useResource } from "@/lib/use-resource";

/** A lab admin's view of one centre: its numbers, its bookings, and its slots (read-only). */
export function CentreOverview() {
  const { centreId } = useParams<{ centreId: string }>();
  const { centres } = useDashboard();
  const bookings = useResource(listBookings, "bookings");
  const [now] = useState(() => Date.now());
  const [tab, setTab] = useState("bookings");

  const back = (
    <Link href="/dashboard/centres" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
      <ChevronLeft className="size-4" /> All centres
    </Link>
  );
  if (!centres) return <ListSkeleton rows={4} />;
  const centre = centres.find((c) => String(c.id) === centreId);
  if (!centre) {
    return <EmptyState icon={SearchX} title="Centre not found" description="It isn't one of your lab's centres." action={back} />;
  }

  const { locality, city } = parseLocation(centre.location);
  const snapshot = bookings.data ? centreSnapshot(bookings.data, centre.id, now) : null;
  const figures = [
    { label: "Revenue (30 days)", value: snapshot ? formatINR(snapshot.kpis.revenue) : "–" },
    { label: "Bookings (30 days)", value: snapshot ? String(snapshot.kpis.bookings) : "–" },
    { label: "Paid rate", value: snapshot ? formatPercent(snapshot.kpis.paidRate) : "–" },
    { label: "Did not arrive", value: snapshot ? String(snapshot.kpis.noShows) : "–" },
    { label: "Next 7 days", value: snapshot ? String(snapshot.upcoming) : "–" },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {back}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-primary">{centre.lab.name}</p>
          <h1 className="text-2xl font-semibold tracking-tight">{branchName(centre)}</h1>
          <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="size-4" aria-hidden /> {locality ? `${locality}, ${city}` : city}
          </p>
        </div>
        <Link href={`/centres/${centre.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
          Public page
        </Link>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {figures.map((f) => (
          <div key={f.label} className="rounded-xl border bg-card p-4">
            <dt className="text-xs text-muted-foreground">{f.label}</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums">{f.value}</dd>
          </div>
        ))}
      </dl>

      <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
        <TabsList>
          <TabsTrigger value="bookings">Bookings</TabsTrigger>
          <TabsTrigger value="slots">Slots</TabsTrigger>
        </TabsList>
        <TabsContent value="bookings" className="pt-4">
          <BookingsManager fixedCentreId={centre.id} />
        </TabsContent>
        <TabsContent value="slots" className="space-y-3 pt-4">
          <p className="text-sm text-muted-foreground">
            Slots are managed by the centre&apos;s own staff; this is a read-only view.
          </p>
          <SlotManager centreId={centre.id} readOnly />
        </TabsContent>
      </Tabs>
    </div>
  );
}
