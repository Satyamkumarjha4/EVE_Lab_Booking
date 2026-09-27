import type { Metadata } from "next";

import { RequireAuth } from "@/components/auth/require-auth";
import { CheckoutView } from "@/components/booking/checkout-view";

export const metadata: Metadata = { title: "Checkout" };

export default function CheckoutPage() {
  return (
    <RequireAuth roles={["CLIENT"]}>
      <CheckoutView />
    </RequireAuth>
  );
}
