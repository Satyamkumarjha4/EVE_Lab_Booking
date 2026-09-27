import type { Metadata } from "next";
import { Suspense } from "react";

import { BookingsManager } from "@/components/dashboard/bookings-manager";

export const metadata: Metadata = { title: "Bookings" };

export default function DashboardBookingsPage() {
  return (
    <Suspense>
      <BookingsManager />
    </Suspense>
  );
}
