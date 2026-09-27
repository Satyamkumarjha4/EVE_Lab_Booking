"use client";

import { Tags } from "lucide-react";
import { useMemo, useState } from "react";

import { PageHeader } from "@/components/common/page-header";
import { SearchInput } from "@/components/common/search-input";
import { SelectField } from "@/components/common/select-field";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/common/states";
import { AddTestDialog } from "@/components/dashboard/add-test-dialog";
import { useDashboard } from "@/components/dashboard/dashboard-context";
import { PriceRow, type MarketStat } from "@/components/dashboard/price-row";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { upcomingByTest } from "@/lib/analytics";
import { errorMessage, listBookings, listCentreTests, listTests } from "@/lib/api";
import { branchName, loadCatalog } from "@/lib/catalog";
import { formatINR } from "@/lib/format";
import type { CentreTest } from "@/lib/types";
import { useResource } from "@/lib/use-resource";
import { canEditPrices } from "@/lib/roles";
import { useUrlFilters } from "@/lib/use-url-filters";

const FILTER_DEFAULTS = { centre: "" };

export function PricingManager() {
  const { user, centres } = useDashboard();
  const isLab = canEditPrices(user);
  const [now] = useState(() => Date.now());
  const bookings = useResource(listBookings, "bookings");
  const [filters, setFilters] = useUrlFilters(FILTER_DEFAULTS);
  const [query, setQuery] = useState("");
  const centre = centres?.find((c) => String(c.id) === filters.centre) ?? centres?.[0];
  const centreId = centre?.id ?? 0;

  const items = useResource(
    () => (centreId ? listCentreTests(centreId, true) : Promise.resolve([])),
    `pricing:${centreId}`
  );
  const globalTests = useResource(listTests, "tests");
  const catalog = useResource(() => (isLab ? loadCatalog() : Promise.resolve(null)), `catalog:${isLab}`);

  // Average active price of each test across every centre on the platform, the lab's own included:
  // if only this lab offers a test, its own price is the market.
  const market = useMemo(() => {
    const totals = new Map<number, { sum: number; n: number; others: number }>();
    for (const o of catalog.data?.offerings ?? []) {
      const t = totals.get(o.test.id) ?? { sum: 0, n: 0, others: 0 };
      const other = o.centre.lab.id !== user.lab ? 1 : 0;
      totals.set(o.test.id, { sum: t.sum + o.price, n: t.n + 1, others: t.others + other });
    }
    return new Map(
      [...totals].map(([id, t]): [number, MarketStat] => [id, { avg: t.sum / t.n, onlyYou: t.others === 0 }])
    );
  }, [catalog.data, user.lab]);
  const upcoming = useMemo(() => upcomingByTest(bookings.data ?? [], now), [bookings.data, now]);

  function upcomingLabel(testId: number) {
    if (!bookings.data) return "–";
    const perCentre = upcoming.get(testId);
    const here = perCentre?.get(centreId) ?? 0;
    if (!isLab) return String(here);
    const total = [...(perCentre?.values() ?? [])].reduce((a, b) => a + b, 0);
    return `${here} here · ${total} all centres`;
  }

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (items.data ?? []).filter((i) => !q || i.test.name.toLowerCase().includes(q));
  }, [items.data, query]);
  const offeredIds = new Set((items.data ?? []).map((i) => i.test.id));
  const available = (globalTests.data ?? []).filter((t) => !offeredIds.has(t.id));
  const active = (items.data ?? []).filter((i) => i.is_active);
  const avgPrice = active.length ? active.reduce((s, i) => s + Number(i.price), 0) / active.length : 0;

  function replace(updated: CentreTest) {
    items.setData((list) => list.map((i) => (i.id === updated.id ? updated : i)));
  }
  function add(item: CentreTest) {
    items.setData((list) => [...list, item].sort((a, b) => a.test.name.localeCompare(b.test.name)));
  }

  const summary = [
    { label: "Tests offered", value: String(items.data?.length ?? "–") },
    { label: "Bookable now", value: String(items.data ? active.length : "–") },
    { label: "Average price", value: items.data ? formatINR(avgPrice) : "–" },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Tests & pricing"
        description={
          isLab
            ? "Set what each centre offers and at what price. Hidden tests stay on existing bookings but can't be booked."
            : "Prices are set by your lab. Switch a test off when your centre can't run it; existing bookings stay."
        }
        actions={
          <>
            {(centres?.length ?? 0) > 1 && (
              <SelectField
                label="Centre"
                value={String(centreId)}
                onChange={(id) => setFilters({ centre: id })}
                options={(centres ?? []).map((c) => ({ value: String(c.id), label: branchName(c) }))}
                className="w-48"
              />
            )}
            {isLab && centreId > 0 && (
              <AddTestDialog key={centreId} centreId={centreId} available={available} onAdded={add} />
            )}
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        {summary.map((s) => (
          <div key={s.label} className="rounded-xl border bg-card p-4">
            <p className="text-sm text-muted-foreground">{s.label}</p>
            <p className="mt-1 text-xl font-semibold">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">{centre ? `${centre.lab.name} · ${branchName(centre)}` : "Centre"}</h2>
        <SearchInput key={centreId} defaultValue="" onSearch={setQuery} placeholder="Search tests" className="w-full max-w-64" />
      </div>

      {items.error ? (
        <ErrorState message={errorMessage(items.error)} onRetry={items.reload} />
      ) : !items.data || !centres ? (
        <ListSkeleton rows={6} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Tags}
          title={query ? "No tests match" : "No tests offered yet"}
          description={isLab ? "Use “Add test” to start offering tests here." : "Your lab hasn't added tests to this centre yet."}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="pl-4">Test</TableHead>
                <TableHead>{isLab ? "Your price" : "Price"}</TableHead>
                {isLab && <TableHead className="hidden md:table-cell">Market average</TableHead>}
                <TableHead>Upcoming bookings</TableHead>
                <TableHead className="pr-4 text-right">Availability</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((item) => (
                <PriceRow
                  key={item.id}
                  centreId={centreId}
                  item={item}
                  editablePrice={isLab}
                  market={isLab ? market.get(item.test.id) ?? null : undefined}
                  upcoming={upcomingLabel(item.test.id)}
                  onChange={replace}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
