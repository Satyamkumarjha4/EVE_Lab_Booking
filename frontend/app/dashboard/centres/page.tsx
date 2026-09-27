import type { Metadata } from "next";

import { RequireAuth } from "@/components/auth/require-auth";
import { CentresManager } from "@/components/dashboard/centres-manager";

export const metadata: Metadata = { title: "Centres" };

export default function CentresPage() {
  return (
    <RequireAuth roles={["LAB"]} loginPath="/business/login">
      <CentresManager />
    </RequireAuth>
  );
}
