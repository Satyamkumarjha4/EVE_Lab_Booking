import type { Metadata } from "next";

import { RequireAuth } from "@/components/auth/require-auth";
import { MyBookings } from "@/components/booking/my-bookings";

export const metadata: Metadata = { title: "My bookings" };

export default function MyBookingsPage() {
  return (
    <RequireAuth roles={["CLIENT"]}>
      <MyBookings />
    </RequireAuth>
  );
}
