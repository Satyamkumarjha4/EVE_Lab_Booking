/** Every centre is in India; appointment times always read in the centre's local time. */
export const CENTRE_TIME_ZONE = "Asia/Kolkata";
const tz = { timeZone: CENTRE_TIME_ZONE } as const;

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});
const inrPrecise = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
});
const compact = new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 });

/** Whole rupees for listings and KPIs: ₹1,234. */
export function formatINR(value: number | string) {
  return inr.format(Number(value));
}

/** Exact amount for receipts and payment screens: ₹1,234.50. */
export function formatINRPrecise(value: number | string) {
  return inrPrecise.format(Number(value));
}

/** Axis ticks: ₹12K, ₹1.2L-style compact figures. */
export function formatINRCompact(value: number) {
  return `₹${compact.format(value)}`;
}

export function formatDate(iso: string | Date) {
  return new Date(iso).toLocaleDateString("en-IN", {
    ...tz,
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDayLabel(iso: string | Date) {
  return new Date(iso).toLocaleDateString("en-IN", {
    ...tz,
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function formatTime(iso: string | Date) {
  return new Date(iso).toLocaleTimeString("en-IN", { ...tz, hour: "numeric", minute: "2-digit" });
}

export function formatDateTime(iso: string | Date) {
  return `${formatDayLabel(iso)}, ${formatTime(iso)}`;
}

export function formatPercent(value: number) {
  return `${(value * 100).toFixed(value > 0 && value < 0.1 ? 1 : 0)}%`;
}

export function bookingCode(id: number) {
  return `EVE-${String(id).padStart(6, "0")}`;
}

export function plural(count: number, noun: string) {
  return `${count} ${count === 1 ? noun : `${noun}s`}`;
}
