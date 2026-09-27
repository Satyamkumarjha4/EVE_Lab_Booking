import { FAILURE_REASONS } from "./payment-reasons";
import { EARNING_STATUSES, STATUS_ORDER } from "./status";
import type { Booking, BookingStatus } from "./types";

const DAY_MS = 86_400_000;

export type RangeKey = "7d" | "30d" | "90d" | "all";

export const RANGES: { key: RangeKey; label: string; days: number | null }[] = [
  { key: "7d", label: "Last 7 days", days: 7 },
  { key: "30d", label: "Last 30 days", days: 30 },
  { key: "90d", label: "Last 90 days", days: 90 },
  { key: "all", label: "All time", days: null },
];

function rangeDays(range: RangeKey) {
  return RANGES.find((r) => r.key === range)?.days ?? null;
}

const createdMs = (b: Booking) => new Date(b.created_at).getTime();

/** Bookings created in the range, plus the equal-length period before it for comparison. */
export function splitByRange(bookings: Booking[], range: RangeKey, now: number) {
  const days = rangeDays(range);
  if (days === null) return { current: bookings, previous: null };
  const start = now - days * DAY_MS;
  const prevStart = start - days * DAY_MS;
  return {
    current: bookings.filter((b) => createdMs(b) >= start),
    previous: bookings.filter((b) => createdMs(b) >= prevStart && createdMs(b) < start),
  };
}

export interface Kpis {
  revenue: number;
  feesKept: number;
  bookings: number;
  paid: number;
  paidRate: number;
  avgOrderValue: number;
  pendingValue: number;
  pendingCount: number;
  completed: number;
  noShows: number;
  cancelled: number;
  failed: number;
  walkIns: number;
}

const sum = (bookings: Booking[]) => bookings.reduce((total, b) => total + Number(b.amount), 0);

const isEarning = (b: Booking) => EARNING_STATUSES.includes(b.status);

/** What the lab keeps from a booking: the full amount if it went ahead, else any retained fee. */
export function bookingRevenue(b: Booking) {
  if (isEarning(b)) return Number(b.amount);
  return b.payment?.status === "SUCCESS" ? Number(b.payment.fee_amount) : 0;
}

/** Walk-ins are bookings the centre desk created (the first history entry is by centre staff). */
const isWalkIn = (b: Booking) => b.events[0]?.actor_role === "CENTRE";

export function computeKpis(bookings: Booking[]): Kpis {
  const byStatus = (s: BookingStatus) => bookings.filter((b) => b.status === s);
  const earning = bookings.filter(isEarning);
  const paid = bookings.filter((b) => b.payment?.status === "SUCCESS");
  const pending = byStatus("PENDING");
  const feesKept = bookings.filter((b) => !isEarning(b)).reduce((t, b) => t + bookingRevenue(b), 0);
  return {
    revenue: sum(earning) + feesKept,
    feesKept,
    bookings: bookings.length,
    paid: paid.length,
    paidRate: bookings.length ? paid.length / bookings.length : 0,
    avgOrderValue: earning.length ? sum(earning) / earning.length : 0,
    pendingValue: sum(pending),
    pendingCount: pending.length,
    completed: byStatus("COMPLETED").length + byStatus("REPORT_DELIVERED").length,
    noShows: byStatus("NO_SHOW").length,
    cancelled: byStatus("CANCELLED").length,
    failed: byStatus("FAILED").length,
    walkIns: bookings.filter(isWalkIn).length,
  };
}

/** Relative change vs the previous period, or null when there is nothing to compare against. */
export function change(current: number, previous: number | undefined) {
  if (previous === undefined || previous === 0) return null;
  return (current - previous) / previous;
}

export interface TrendPoint {
  start: number;
  label: string;
  revenue: number;
  bookings: number;
}

/** Daily buckets up to 30 days, weekly beyond that. */
export function trend(
  bookings: Booking[],
  range: RangeKey,
  now: number
): { points: TrendPoint[]; bucket: "day" | "week" } {
  const days = rangeDays(range);
  const earliest = bookings.length ? Math.min(...bookings.map(createdMs)) : now;
  const spanDays = days ?? Math.max(7, Math.ceil((now - earliest) / DAY_MS));
  const bucketDays = spanDays > 31 ? 7 : 1;
  const bucketCount = Math.ceil(spanDays / bucketDays);

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const firstStart = today.getTime() - (bucketCount - 1) * bucketDays * DAY_MS;

  const points: TrendPoint[] = Array.from({ length: bucketCount }, (_, i) => {
    const start = firstStart + i * bucketDays * DAY_MS;
    const label = new Date(start).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    return { start, label, revenue: 0, bookings: 0 };
  });

  for (const b of bookings) {
    const index = Math.floor((createdMs(b) - firstStart) / (bucketDays * DAY_MS));
    const point = points[index];
    if (!point) continue;
    point.bookings += 1;
    point.revenue += bookingRevenue(b);
  }
  return { points, bucket: bucketDays === 7 ? "week" : "day" };
}

export function statusBreakdown(bookings: Booking[]) {
  return STATUS_ORDER.map((status) => {
    const count = bookings.filter((b) => b.status === status).length;
    return { status, count, share: bookings.length ? count / bookings.length : 0 };
  });
}

export interface Ranked {
  key: string;
  label: string;
  sublabel?: string;
  revenue: number;
  count: number;
}

export function rankBy(
  bookings: Booking[],
  keyOf: (b: Booking) => { key: string; label: string; sublabel?: string },
  limit: number
): Ranked[] {
  const groups = new Map<string, Ranked>();
  for (const b of bookings) {
    const { key, label, sublabel } = keyOf(b);
    const group = groups.get(key) ?? { key, label, sublabel, revenue: 0, count: 0 };
    group.count += 1;
    group.revenue += bookingRevenue(b);
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => b.revenue - a.revenue).slice(0, limit);
}

/** Appointment load by hour of day, for staffing. Cancelled/failed bookings don't show up. */
export function hourlyLoad(bookings: Booking[]) {
  const counts = new Map<number, number>();
  for (const b of bookings) {
    if (b.status === "CANCELLED" || b.status === "FAILED") continue;
    const hour = new Date(b.appointment_at).getHours();
    counts.set(hour, (counts.get(hour) ?? 0) + 1);
  }
  const hours = [...counts.keys()];
  const first = Math.min(7, ...hours);
  const last = Math.max(18, ...hours);
  return Array.from({ length: last - first + 1 }, (_, i) => {
    const hour = first + i;
    const label = new Date(2000, 0, 1, hour).toLocaleTimeString("en-IN", { hour: "numeric" });
    return { hour, label, count: counts.get(hour) ?? 0 };
  });
}

export function upcomingAppointments(bookings: Booking[], now: number, days = 7) {
  const end = now + days * DAY_MS;
  return bookings
    .filter((b) => b.status === "CONFIRMED" || b.status === "PENDING")
    .filter((b) => {
      const at = new Date(b.appointment_at).getTime();
      return at >= now && at <= end;
    })
    .sort((a, b) => a.appointment_at.localeCompare(b.appointment_at));
}

/** Why bookings failed payment or were cancelled, most common first. */
export function reasonBreakdown(bookings: Booking[], status: "FAILED" | "CANCELLED", limit = 5) {
  const counts = new Map<string, number>();
  for (const b of bookings) {
    if (b.status !== status) continue;
    const reason =
      status === "FAILED"
        ? b.payment?.failure_reason
          ? FAILURE_REASONS[b.payment.failure_reason].label
          : "Not recorded"
        : b.cancellation?.reason || "Not recorded";
    counts.set(reason, (counts.get(reason) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/** One centre's last-30-day KPIs and its appointments in the coming week. */
export function centreSnapshot(bookings: Booking[], centreId: number, now: number) {
  const mine = bookings.filter((b) => b.centre_test.centre.id === centreId);
  return {
    kpis: computeKpis(splitByRange(mine, "30d", now).current),
    upcoming: upcomingAppointments(mine, now).length,
  };
}

/** Upcoming (pending or awaiting-arrival) bookings per test id, then per centre id. */
export function upcomingByTest(bookings: Booking[], now: number) {
  const counts = new Map<number, Map<number, number>>();
  for (const b of bookings) {
    if (b.status !== "PENDING" && b.status !== "CONFIRMED") continue;
    if (new Date(b.appointment_at).getTime() < now) continue;
    const perCentre = counts.get(b.centre_test.test.id) ?? new Map<number, number>();
    const centreId = b.centre_test.centre.id;
    perCentre.set(centreId, (perCentre.get(centreId) ?? 0) + 1);
    counts.set(b.centre_test.test.id, perCentre);
  }
  return counts;
}
