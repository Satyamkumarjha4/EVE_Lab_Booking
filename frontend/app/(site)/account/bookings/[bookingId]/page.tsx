import type { Metadata } from "next";

import { RequireAuth } from "@/components/auth/require-auth";
import { BookingDetail } from "@/components/booking/booking-detail";

export const metadata: Metadata = { title: "Booking details" };

export default function AccountBookingPage() {
  return (
    <RequireAuth roles={["CLIENT"]}>
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <BookingDetail backHref="/account/bookings" backLabel="My bookings" />
      </div>
    </RequireAuth>
  );
}
