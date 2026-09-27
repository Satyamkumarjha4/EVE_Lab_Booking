"use client";

import { CalendarClock, CalendarPlus, Clock, Wallet } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { BookingCard } from "@/components/booking/booking-card";
import { PageHeader } from "@/components/common/page-header";
import { SearchInput } from "@/components/common/search-input";
import { SelectField } from "@/components/common/select-field";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/common/states";
import { buttonVariants } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { errorMessage, listBookings } from "@/lib/api";
import { formatINR } from "@/lib/format";
import { STATUS_META, STATUS_ORDER } from "@/lib/status";
import type { Booking } from "@/lib/types";
import { useResource } from "@/lib/use-resource";

type View = "upcoming" | "past" | "all";

const STATUS_OPTIONS = [
  { value: "all", label: "Any status" },
  ...STATUS_ORDER.map((s) => ({ value: s, label: STATUS_META[s].label })),
];

function isUpcoming(booking: Booking, now: number) {
  return (
    new Date(booking.appointment_at).getTime() >= now &&
    (booking.status === "PENDING" || booking.status === "CONFIRMED")
  );
}

export function MyBookings() {
  const bookings = useResource(listBookings, "bookings");
  const [now] = useState(() => Date.now());
  const [view, setView] = useState<View>("upcoming");
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");

  const all = useMemo(() => bookings.data ?? [], [bookings.data]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = all.filter((b) => {
      if (view === "upcoming" && !isUpcoming(b, now)) return false;
      if (view === "past" && isUpcoming(b, now)) return false;
      if (status !== "all" && b.status !== status) return false;
      const haystack = `${b.centre_test.test.name} ${b.centre_test.centre.name} ${b.centre_test.centre.location}`;
      return !q || haystack.toLowerCase().includes(q);
    });
    // Upcoming reads soonest-first; history reads most-recent-first.
    return list.sort((a, b) =>
      view === "upcoming"
        ? a.appointment_at.localeCompare(b.appointment_at)
        : b.appointment_at.localeCompare(a.appointment_at)
    );
  }, [all, view, status, query, now]);

  const upcomingCount = all.filter((b) => isUpcoming(b, now)).length;
  const pending = all.filter((b) => b.status === "PENDING");
  // What actually left the patient's account: captured payments minus any refunds.
  const spent = all.reduce(
    (t, b) =>
      b.payment?.status === "SUCCESS" ? t + Number(b.amount) - Number(b.payment.refund_amount) : t,
    0
  );

  function replace(updated: Booking) {
    bookings.setData((list) => list.map((b) => (b.id === updated.id ? updated : b)));
  }

  const tiles = [
    { icon: CalendarClock, label: "Upcoming visits", value: String(upcomingCount) },
    { icon: Clock, label: "Awaiting payment", value: String(pending.length) },
    { icon: Wallet, label: "Total paid", value: formatINR(spent) },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title="My bookings"
        description="Upcoming visits, payments and your booking history."
        actions={
          <Link href="/tests" className={buttonVariants()}>
            <CalendarPlus /> Book a test
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        {tiles.map((tile) => (
          <div key={tile.label} className="flex items-center gap-3 rounded-xl border bg-card p-4">
            <span className="flex size-10 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
              <tile.icon className="size-5" aria-hidden />
            </span>
            <div>
              <p className="text-sm text-muted-foreground">{tile.label}</p>
              <p className="text-xl font-semibold">{bookings.data ? tile.value : "–"}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Tabs value={view} onValueChange={(v) => setView(v as View)}>
          <TabsList>
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="past">Past</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex gap-2">
          <SearchInput defaultValue="" onSearch={setQuery} placeholder="Search test or centre" className="flex-1 md:w-64" />
          <SelectField label="Status" value={status} onChange={setStatus} options={STATUS_OPTIONS} className="w-40" />
        </div>
      </div>

      {bookings.error ? (
        <ErrorState message={errorMessage(bookings.error, "Couldn't load your bookings.")} onRetry={bookings.reload} />
      ) : !bookings.data ? (
        <ListSkeleton />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title={all.length === 0 ? "No bookings yet" : "Nothing here"}
          description={
            all.length === 0
              ? "Find a test, pick a centre and slot, and it will show up here."
              : "No bookings match this view. Try another tab or filter."
          }
          action={all.length === 0 && <Link href="/tests" className={buttonVariants()}>Find a test</Link>}
        />
      ) : (
        <ul className="space-y-3">
          {visible.map((booking) => (
            <BookingCard key={booking.id} booking={booking} onChange={replace} now={now} />
          ))}
        </ul>
      )}
    </div>
  );
}
