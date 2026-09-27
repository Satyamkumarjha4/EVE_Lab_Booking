import type { Metadata } from "next";
import { Suspense } from "react";

import { RequireAuth } from "@/components/auth/require-auth";
import { PricingManager } from "@/components/dashboard/pricing-manager";

export const metadata: Metadata = { title: "Tests & pricing" };

export default function CatalogPage() {
  return (
    <RequireAuth roles={["LAB", "CENTRE"]} loginPath="/business/login">
      <Suspense>
        <PricingManager />
      </Suspense>
    </RequireAuth>
  );
}
