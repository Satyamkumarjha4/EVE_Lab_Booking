"use client";

import { ArrowRight, Building2, MapPin, Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { PageHeader } from "@/components/common/page-header";
import { CardGridSkeleton, EmptyState } from "@/components/common/states";
import { CentreDialog } from "@/components/dashboard/centre-dialog";
import { useDashboard } from "@/components/dashboard/dashboard-context";
import { LabPolicyCard } from "@/components/dashboard/lab-policy-card";
import { Button, buttonVariants } from "@/components/ui/button";
import { centreSnapshot } from "@/lib/analytics";
import { listBookings } from "@/lib/api";
import { branchName, parseLocation } from "@/lib/catalog";
import { formatINR, formatPercent } from "@/lib/format";
import { useResource } from "@/lib/use-resource";

/** The lab's centres with last-30-day performance; each opens its own bookings and slots. */
export function CentresManager() {
  const { centres, scopeLabel, reloadCentres } = useDashboard();
  const bookings = useResource(listBookings, "bookings");
  const [now] = useState(() => Date.now());
  const labName = centres?.[0]?.lab.name ?? scopeLabel;

  const snapshots = useMemo(
    () => new Map((centres ?? []).map((c) => [c.id, centreSnapshot(bookings.data ?? [], c.id, now)])),
    [bookings.data, centres, now]
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Centres"
        description={`All ${labName} centres, with performance over the last 30 days.`}
        actions={
          <CentreDialog labName={labName} onSaved={reloadCentres} trigger={<Button><Plus /> Add centre</Button>} />
        }
      />

      <LabPolicyCard onSaved={reloadCentres} />

      {!centres ? (
        <CardGridSkeleton count={3} />
      ) : centres.length === 0 ? (
        <EmptyState icon={Building2} title="No centres yet" description="Add your first centre to start taking bookings." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {centres.map((centre) => {
            const { locality, city } = parseLocation(centre.location);
            const snapshot = bookings.data ? snapshots.get(centre.id) : undefined;
            const figures = [
              { label: "Revenue", value: snapshot ? formatINR(snapshot.kpis.revenue) : "–" },
              { label: "Bookings", value: snapshot ? String(snapshot.kpis.bookings) : "–" },
              { label: "Paid rate", value: snapshot ? formatPercent(snapshot.kpis.paidRate) : "–" },
              { label: "Next 7 days", value: snapshot ? String(snapshot.upcoming) : "–" },
            ];
            const detail = `/dashboard/centres/${centre.id}`;
            return (
              <div key={centre.id} className="flex flex-col rounded-xl border bg-card transition hover:border-primary/40">
                <div className="flex items-start justify-between gap-3 p-5">
                  <Link href={detail} className="group min-w-0">
                    <p className="text-xs font-medium text-primary">{centre.lab.name}</p>
                    <h2 className="truncate text-lg font-semibold group-hover:text-primary">{branchName(centre)}</h2>
                    <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="size-3.5" aria-hidden /> {locality ? `${locality}, ${city}` : city}
                    </p>
                  </Link>
                  <CentreDialog
                    labName={centre.lab.name}
                    centre={centre}
                    onSaved={reloadCentres}
                    trigger={<Button variant="ghost" size="icon-sm" aria-label={`Edit ${branchName(centre)}`}><Pencil /></Button>}
                  />
                </div>
                <dl className="grid grid-cols-2 gap-px border-y bg-border">
                  {figures.map((f) => (
                    <div key={f.label} className="bg-card px-5 py-3">
                      <dt className="text-xs text-muted-foreground">{f.label}</dt>
                      <dd className="font-semibold tabular-nums">{f.value}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-auto flex gap-2 p-4">
                  <Link href={detail} className={buttonVariants({ size: "sm" })}>
                    Bookings & slots <ArrowRight />
                  </Link>
                  <Link href={`/centres/${centre.id}`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                    Public page
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
