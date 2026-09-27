import type { Metadata } from "next";

import { RequireAuth } from "@/components/auth/require-auth";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { BUSINESS_ROLES } from "@/lib/roles";

export const metadata: Metadata = {
  title: { default: "Dashboard · EVE Business", template: "%s · EVE Business" },
};

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <RequireAuth roles={BUSINESS_ROLES} loginPath="/business/login">
      <DashboardShell>{children}</DashboardShell>
    </RequireAuth>
  );
}
