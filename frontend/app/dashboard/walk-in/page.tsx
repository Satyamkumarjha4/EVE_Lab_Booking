import type { Metadata } from "next";

import { RequireAuth } from "@/components/auth/require-auth";
import { WalkIn } from "@/components/dashboard/walk-in";

export const metadata: Metadata = { title: "Walk-in booking" };

export default function WalkInPage() {
  return (
    <RequireAuth roles={["CENTRE"]} loginPath="/business/login">
      <WalkIn />
    </RequireAuth>
  );
}
