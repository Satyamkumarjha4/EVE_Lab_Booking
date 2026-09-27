import { bookingCode } from "./format";
import { outcomeReason } from "./status";
import type { Booking } from "./types";

export const BOOKING_FILTER_DEFAULTS = {
  q: "",
  status: "all",
  centre: "all",
  when: "all",
  sort: "created",
};

export type BookingFilters = typeof BOOKING_FILTER_DEFAULTS;

export const WHEN_OPTIONS = [
  { value: "all", label: "Any date" },
  { value: "today", label: "Visiting today" },
  { value: "upcoming", label: "Upcoming visits" },
  { value: "past", label: "Past visits" },
];

export const SORT_OPTIONS = [
  { value: "created", label: "Newest booked" },
  { value: "appointment", label: "Appointment time" },
  { value: "amount", label: "Amount (high–low)" },
];

function sameLocalDay(iso: string, now: number) {
  return new Date(iso).toDateString() === new Date(now).toDateString();
}

/** Everything except the status filter, so status chips can show counts for the rest. */
export function filterBookingsExceptStatus(bookings: Booking[], f: BookingFilters, now: number) {
  const q = f.q.trim().toLowerCase();
  return bookings.filter((b) => {
    if (f.centre !== "all" && String(b.centre_test.centre.id) !== f.centre) return false;
    const at = new Date(b.appointment_at).getTime();
    if (f.when === "today" && !sameLocalDay(b.appointment_at, now)) return false;
    if (f.when === "upcoming" && at < now) return false;
    if (f.when === "past" && at >= now) return false;
    if (!q) return true;
    const patient = b.patient ? `${b.patient.full_name} ${b.patient.email} ${b.patient.phone}` : "";
    const haystack = `${bookingCode(b.id)} ${b.id} ${b.centre_test.test.name} ${b.centre_test.centre.name} ${patient}`;
    return haystack.toLowerCase().includes(q);
  });
}

export function applyStatusAndSort(bookings: Booking[], f: BookingFilters) {
  const list = f.status === "all" ? [...bookings] : bookings.filter((b) => b.status === f.status);
  if (f.sort === "appointment") list.sort((a, b) => a.appointment_at.localeCompare(b.appointment_at));
  else if (f.sort === "amount") list.sort((a, b) => Number(b.amount) - Number(a.amount));
  else list.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return list;
}

function csvCell(value: string | number) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function downloadBookingsCsv(bookings: Booking[]) {
  const header = [
    "Booking",
    "Patient",
    "Patient email",
    "Test",
    "Lab",
    "Centre",
    "Location",
    "Appointment",
    "Amount (INR)",
    "Status",
    "Reason",
    "Refunded (INR)",
    "Fee kept (INR)",
    "Booked at",
  ];
  const rows = bookings.map((b) => [
    bookingCode(b.id),
    b.patient?.full_name ?? "",
    b.patient?.email ?? "",
    b.centre_test.test.name,
    b.centre_test.centre.lab.name,
    b.centre_test.centre.name,
    b.centre_test.centre.location,
    b.appointment_at,
    b.amount,
    b.status,
    outcomeReason(b) ?? "",
    b.payment?.refund_amount ?? "0.00",
    b.payment?.fee_amount ?? "0.00",
    b.created_at,
  ]);
  const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `eve-bookings-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
