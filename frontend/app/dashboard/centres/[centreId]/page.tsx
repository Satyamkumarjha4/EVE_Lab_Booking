import type { Metadata } from "next";
import { Suspense } from "react";

import { RequireAuth } from "@/components/auth/require-auth";
import { CentreOverview } from "@/components/dashboard/centre-overview";

export const metadata: Metadata = { title: "Centre" };

export default function CentrePage() {
  return (
    <RequireAuth roles={["LAB"]} loginPath="/business/login">
      <Suspense>
        <CentreOverview />
      </Suspense>
    </RequireAuth>
  );
}
