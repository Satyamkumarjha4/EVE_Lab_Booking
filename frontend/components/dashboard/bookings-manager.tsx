"use client";

import { CalendarSearch, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { useMemo, useState } from "react";

import { PageHeader } from "@/components/common/page-header";
import { SearchInput } from "@/components/common/search-input";
import { SelectField } from "@/components/common/select-field";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/common/states";
import { BookingsTable } from "@/components/dashboard/bookings-table";
import { useDashboard } from "@/components/dashboard/dashboard-context";
import { Button } from "@/components/ui/button";
import { errorMessage, listBookings } from "@/lib/api";
import {
  applyStatusAndSort,
  BOOKING_FILTER_DEFAULTS,
  downloadBookingsCsv,
  filterBookingsExceptStatus,
  SORT_OPTIONS,
  WHEN_OPTIONS,
} from "@/lib/booking-filters";
import { branchName } from "@/lib/catalog";
import { STATUS_META, STATUS_ORDER } from "@/lib/status";
import type { Booking } from "@/lib/types";
import { useResource } from "@/lib/use-resource";
import { useUrlFilters } from "@/lib/use-url-filters";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

/**
 * The filterable bookings table. With `fixedCentreId` it shows one centre's bookings only and
 * leaves the page heading to its host (the lab's centre detail page).
 */
export function BookingsManager({ fixedCentreId }: { fixedCentreId?: number }) {
  const { user, centres } = useDashboard();
  const bookings = useResource(listBookings, "bookings");
  const [urlFilters, setFilters] = useUrlFilters(BOOKING_FILTER_DEFAULTS);
  const [page, setPage] = useState(0);
  const [searchKey, setSearchKey] = useState(0);
  const [now] = useState(() => Date.now());
  const multiCentre = !fixedCentreId && (centres?.length ?? 0) > 1;

  const filters = useMemo(
    () => (fixedCentreId ? { ...urlFilters, centre: String(fixedCentreId) } : urlFilters),
    [urlFilters, fixedCentreId]
  );
  const base = useMemo(
    () => filterBookingsExceptStatus(bookings.data ?? [], filters, now),
    [bookings.data, filters, now]
  );
  const rows = useMemo(() => applyStatusAndSort(base, filters), [base, filters]);
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const pageRows = rows.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  function update(changes: Partial<typeof filters>) {
    setFilters(changes);
    setPage(0);
  }

  function reset() {
    update({ q: "", status: "all", centre: "all", when: "all" });
    setSearchKey((k) => k + 1);
  }

  function replace(updated: Booking) {
    bookings.setData((list) => list.map((b) => (b.id === updated.id ? updated : b)));
  }

  const chips = [
    { value: "all", label: "All", count: base.length },
    ...STATUS_ORDER.map((s) => ({ value: s, label: STATUS_META[s].label, count: base.filter((b) => b.status === s).length })),
  ];

  const exportButton = (
    <Button variant="outline" disabled={rows.length === 0} onClick={() => downloadBookingsCsv(rows)}>
      <Download /> Export CSV
    </Button>
  );

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      {fixedCentreId ? (
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Bookings</h2>
          {exportButton}
        </div>
      ) : (
        <PageHeader
          title="Bookings"
          description={
            user.role === "LAB"
              ? "Every booking across your centres. Labs can cancel bookings before the appointment."
              : "Bookings at your centre. Mark tests completed and reports delivered from a booking."
          }
          actions={exportButton}
        />
      )}

      <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filter by status">
        {chips.map((chip) => (
          <button
            key={chip.value}
            type="button"
            aria-pressed={filters.status === chip.value}
            onClick={() => update({ status: chip.value })}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1 text-sm transition-colors",
              filters.status === chip.value
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:text-foreground"
            )}
          >
            {chip.label} <span className="ml-1 tabular-nums opacity-75">{chip.count}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2 rounded-xl border bg-card p-3 lg:flex-row lg:items-center">
        <SearchInput
          key={searchKey}
          defaultValue={filters.q}
          onSearch={(q) => update({ q })}
          placeholder="Search booking ID, test, patient name or email"
          className="flex-1"
        />
        <div className="grid grid-cols-2 gap-2 sm:flex">
          {multiCentre && (
            <SelectField
              label="Centre"
              value={filters.centre}
              onChange={(centre) => update({ centre })}
              options={[
                { value: "all", label: "All centres" },
                ...(centres ?? []).map((c) => ({ value: String(c.id), label: branchName(c) })),
              ]}
              className="w-full sm:w-44"
            />
          )}
          <SelectField label="Appointment date" value={filters.when} onChange={(when) => update({ when })} options={WHEN_OPTIONS} className="w-full sm:w-40" />
          <SelectField label="Sort by" value={filters.sort} onChange={(sort) => update({ sort })} options={SORT_OPTIONS} className="w-full sm:w-44" />
        </div>
      </div>

      {bookings.error ? (
        <ErrorState message={errorMessage(bookings.error, "Couldn't load bookings.")} onRetry={bookings.reload} />
      ) : !bookings.data ? (
        <ListSkeleton rows={8} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={CalendarSearch}
          title="No bookings match"
          description="Try clearing a filter or searching for something else."
          action={<Button variant="outline" onClick={reset}>Clear filters</Button>}
        />
      ) : (
        <>
          <BookingsTable bookings={pageRows} user={user} showCentre={multiCentre} onChange={replace} now={now} />
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
            <p>
              Showing {currentPage * PAGE_SIZE + 1}–{currentPage * PAGE_SIZE + pageRows.length} of{" "}
              <span className="font-medium text-foreground">{rows.length}</span>
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>
                <ChevronLeft /> Previous
              </Button>
              <span className="tabular-nums">
                {currentPage + 1} / {pageCount}
              </span>
              <Button variant="outline" size="sm" disabled={currentPage >= pageCount - 1} onClick={() => setPage(currentPage + 1)}>
                Next <ChevronRight />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
