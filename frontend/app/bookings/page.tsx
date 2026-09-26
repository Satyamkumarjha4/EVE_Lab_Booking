"use client";

import { useEffect, useState } from "react";

import { BookingRow } from "@/components/booking-row";
import { ProtectedRoute } from "@/components/protected-route";
import { listBookings } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { Booking } from "@/lib/types";

function BookingsList() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listBookings()
      .then(setBookings)
      .catch(() => setError("Could not load bookings."));
  }, []);

  // Client cancels their own booking; Lab cancels any booking in this (already role-scoped) list.
  const canCancel = user?.role === "CLIENT" || user?.role === "LAB";
  const isLab = user?.role === "LAB";

  function handleCancelled(updated: Booking) {
    setBookings((prev) =>
      prev ? prev.map((b) => (b.id === updated.id ? updated : b)) : prev
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">
          {isLab ? "Bookings dashboard" : "My bookings"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isLab
            ? "All bookings across your centres."
            : "Your booking history and status."}
        </p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!error && bookings === null && (
        <p className="text-sm text-muted-foreground">Loading…</p>
      )}
      {bookings?.length === 0 && (
        <p className="text-sm text-muted-foreground">No bookings yet.</p>
      )}
      <ul className="divide-y rounded-md border px-4">
        {bookings?.map((booking) => (
          <BookingRow
            key={booking.id}
            booking={booking}
            canCancel={canCancel}
            onCancelled={handleCancelled}
          />
        ))}
      </ul>
    </div>
  );
}

export default function BookingsPage() {
  return (
    <ProtectedRoute>
      <BookingsList />
    </ProtectedRoute>
  );
}
