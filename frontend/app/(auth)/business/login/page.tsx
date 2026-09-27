import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Business sign in" };

export default function BusinessLoginPage() {
  return (
    <AuthShell
      tone="business"
      heading="Run your diagnostics business from one dashboard."
      points={[
        "Revenue, booking and conversion analytics across every centre",
        "Manage test prices and availability per centre",
        "Register walk-in patients and collect payment at the desk",
      ]}
      title="Business sign in"
      subtitle="For lab administrators and centre staff. Accounts are issued by EVE."
      footer={
        <p>
          Looking to book a test?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Patient sign in
          </Link>
        </p>
      }
    >
      <Suspense>
        <LoginForm
          demoAccounts={[
            { email: "lab@demo.eve", label: "Lab admin (Apollo)" },
            { email: "centre@demo.eve", label: "Centre staff" },
          ]}
        />
      </Suspense>
    </AuthShell>
  );
}
