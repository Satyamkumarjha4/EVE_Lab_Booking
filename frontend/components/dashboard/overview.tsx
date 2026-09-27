"use client";

import { ArrowRight, BadgeCheck, CalendarRange, IndianRupee, Receipt } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { PageHeader } from "@/components/common/page-header";
import { SelectField } from "@/components/common/select-field";
import { ErrorState } from "@/components/common/states";
import { HourlyChart } from "@/components/dashboard/charts/hourly-chart";
import { RankedBars } from "@/components/dashboard/charts/ranked-bars";
import { StatusBreakdown } from "@/components/dashboard/charts/status-breakdown";
import { TrendChart } from "@/components/dashboard/charts/trend-chart";
import { ReasonList } from "@/components/dashboard/charts/reason-list";
import { BookingsTable } from "@/components/dashboard/bookings-table";
import { useDashboard } from "@/components/dashboard/dashboard-context";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { UpcomingList } from "@/components/dashboard/upcoming-list";
import { Skeleton } from "@/components/ui/skeleton";
import {
  change,
  computeKpis,
  hourlyLoad,
  RANGES,
  rankBy,
  reasonBreakdown,
  splitByRange,
  statusBreakdown,
  trend,
  upcomingAppointments,
  type RangeKey,
} from "@/lib/analytics";
import { errorMessage, listBookings } from "@/lib/api";
import { branchName, parseLocation } from "@/lib/catalog";
import { formatINR, formatPercent } from "@/lib/format";
import { useResource } from "@/lib/use-resource";

function greeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function Overview() {
  const { user, scopeLabel, centres } = useDashboard();
  const bookings = useResource(listBookings, "bookings");
  const [range, setRange] = useState<RangeKey>("30d");
  const [now] = useState(() => Date.now());
  const multiCentre = (centres?.length ?? 0) > 1;

  const stats = useMemo(() => {
    if (!bookings.data) return null;
    const { current, previous } = splitByRange(bookings.data, range, now);
    const kpis = computeKpis(current);
    const prev = previous ? computeKpis(previous) : null;
    const { points, bucket } = trend(current, range, now);
    return {
      current,
      kpis,
      deltas: {
        revenue: change(kpis.revenue, prev?.revenue),
        bookings: change(kpis.bookings, prev?.bookings),
        rate: prev && prev.bookings ? kpis.paidRate - prev.paidRate : null,
        aov: change(kpis.avgOrderValue, prev?.avgOrderValue),
      },
      points,
      bucket,
      status: statusBreakdown(current),
      topTests: rankBy(current, (b) => ({ key: String(b.centre_test.test.id), label: b.centre_test.test.name }), 5),
      topCentres: rankBy(
        current,
        (b) => ({
          key: String(b.centre_test.centre.id),
          label: branchName(b.centre_test.centre),
          sublabel: parseLocation(b.centre_test.centre.location).city,
        }),
        5
      ),
      hours: hourlyLoad(current),
      failureReasons: reasonBreakdown(current, "FAILED"),
      cancelReasons: reasonBreakdown(current, "CANCELLED"),
      upcoming: upcomingAppointments(bookings.data, now),
      recent: bookings.data.slice(0, 6),
    };
  }, [bookings.data, range, now]);

  const rangeLabel = RANGES.find((r) => r.key === range)!.label.toLowerCase();
  const comparison = range === "all" ? undefined : "vs previous period";

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        eyebrow={greeting(new Date(now).getHours())}
        title={scopeLabel}
        description={`Performance for the ${rangeLabel}.`}
        actions={
          <SelectField
            label="Date range"
            value={range}
            onChange={setRange}
            options={RANGES.map((r) => ({ value: r.key, label: r.label }))}
            className="w-40"
          />
        }
      />

      {bookings.error ? (
        <ErrorState message={errorMessage(bookings.error, "Couldn't load bookings.")} onRetry={bookings.reload} />
      ) : !stats ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className={i < 4 ? "h-32 rounded-xl" : "h-72 rounded-xl sm:col-span-2"} />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Revenue" icon={IndianRupee} value={formatINR(stats.kpis.revenue)} delta={stats.deltas.revenue} comparison={comparison} hint={`Incl. ${formatINR(stats.kpis.feesKept)} in fees kept`} />
            <KpiCard label="Bookings" icon={CalendarRange} value={String(stats.kpis.bookings)} delta={stats.deltas.bookings} comparison={comparison} hint={`${stats.kpis.walkIns} walk-ins`} />
            <KpiCard label="Paid rate" icon={BadgeCheck} value={formatPercent(stats.kpis.paidRate)} delta={stats.deltas.rate} deltaUnit="pts" comparison={comparison} hint={`${stats.kpis.paid} bookings paid`} />
            <KpiCard label="Avg. order value" icon={Receipt} value={formatINR(stats.kpis.avgOrderValue)} delta={stats.deltas.aov} comparison={comparison} hint="Per booking that went ahead" />
          </div>

          <dl className="grid grid-cols-2 gap-4 rounded-xl border bg-card p-4 text-sm sm:grid-cols-5">
            {[
              { label: "Awaiting payment", value: `${stats.kpis.pendingCount} · ${formatINR(stats.kpis.pendingValue)}` },
              { label: "Tests completed", value: String(stats.kpis.completed) },
              { label: "Did not arrive", value: String(stats.kpis.noShows) },
              { label: "Payments declined", value: String(stats.kpis.failed) },
              { label: "Cancelled", value: String(stats.kpis.cancelled) },
            ].map((item) => (
              <div key={item.label}>
                <dt className="text-muted-foreground">{item.label}</dt>
                <dd className="font-medium tabular-nums">{item.value}</dd>
              </div>
            ))}
          </dl>

          <div className="grid gap-4 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <TrendChart points={stats.points} bucket={stats.bucket} />
            </div>
            <StatusBreakdown data={stats.status} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <RankedBars title="Top tests" subtitle="By revenue (incl. fees kept)" items={stats.topTests} empty="No bookings in this period." />
            {multiCentre ? (
              <RankedBars title="Centres" subtitle="By revenue (incl. fees kept)" items={stats.topCentres} empty="No bookings in this period." />
            ) : (
              <HourlyChart data={stats.hours} />
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ReasonList
              title="Why payments fail"
              subtitle="Decline reasons reported by banks and UPI apps"
              items={stats.failureReasons}
              empty="No declined payments in this period."
            />
            <ReasonList
              title="Why bookings are cancelled"
              subtitle="Reasons given by patients, the lab, or expired payment windows"
              items={stats.cancelReasons}
              empty="No cancellations in this period."
            />
          </div>

          <div className={multiCentre ? "grid gap-4 lg:grid-cols-2" : undefined}>
            {multiCentre && <HourlyChart data={stats.hours} />}
            <UpcomingList bookings={stats.upcoming} showCentre={multiCentre} />
          </div>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Latest bookings</h2>
              <Link href="/dashboard/bookings" className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                All bookings <ArrowRight className="size-4" />
              </Link>
            </div>
            <BookingsTable bookings={stats.recent} user={user} showCentre={multiCentre} now={now} />
          </section>
        </>
      )}
    </div>
  );
}
