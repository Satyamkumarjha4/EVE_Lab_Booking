import type { Metadata } from "next";

import { RequireAuth } from "@/components/auth/require-auth";
import { CentreSlots } from "@/components/dashboard/slots/centre-slots";

export const metadata: Metadata = { title: "Slots" };

export default function SlotsPage() {
  return (
    <RequireAuth roles={["CENTRE"]} loginPath="/business/login">
      <CentreSlots />
    </RequireAuth>
  );
}
