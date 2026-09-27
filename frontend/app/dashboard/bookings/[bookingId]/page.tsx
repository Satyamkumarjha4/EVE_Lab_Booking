import type { Metadata } from "next";

import { BookingDetail } from "@/components/booking/booking-detail";

export const metadata: Metadata = { title: "Booking details" };

export default function DashboardBookingPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <BookingDetail backHref="/dashboard/bookings" backLabel="All bookings" />
    </div>
  );
}
