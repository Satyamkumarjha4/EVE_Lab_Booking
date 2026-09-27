import type { ActorRole, Booking, Me, Role } from "./types";

export const BUSINESS_ROLES: Role[] = ["LAB", "CENTRE", "PLATFORM_ADMIN"];

export function isBusiness(user: Me | null) {
  return !!user && BUSINESS_ROLES.includes(user.role);
}

/** Where a user lands after logging in. */
export function homeFor(user: Me) {
  return isBusiness(user) ? "/dashboard" : "/account/bookings";
}

/**
 * Mirrors the backend rule: the client (own) and the lab (own centres) can cancel a pending or
 * confirmed booking, and only before its appointment.
 */
export function canCancel(user: Me | null, booking: Booking, now = Date.now()) {
  const cancellable = booking.status === "PENDING" || booking.status === "CONFIRMED";
  const beforeAppointment = new Date(booking.appointment_at).getTime() > now;
  return cancellable && beforeAppointment && (user?.role === "CLIENT" || user?.role === "LAB");
}

/** Clients pay for their own bookings; centres collect payment for walk-ins. */
export function canPay(user: Me | null, booking: Booking) {
  return booking.status === "PENDING" && (user?.role === "CLIENT" || user?.role === "CENTRE");
}

/** Centre staff and the lab record the visit and the report. */
export function canRecordVisit(user: Me | null) {
  return user?.role === "CENTRE" || user?.role === "LAB";
}

/** Prices are the lab's decision; centres only switch tests on and off. */
export function canEditPrices(user: Me | null) {
  return user?.role === "LAB";
}

export const ROLE_LABEL: Record<Role, string> = {
  PLATFORM_ADMIN: "Platform admin",
  LAB: "Lab admin",
  CENTRE: "Centre staff",
  CLIENT: "Patient",
};

/** Who did something, as shown in a booking's history. */
export const ACTOR_LABEL: Record<ActorRole, string> = {
  CLIENT: "Patient",
  CENTRE: "Centre staff",
  LAB: "Lab",
  PLATFORM_ADMIN: "Platform admin",
  SYSTEM: "Automatic",
};
