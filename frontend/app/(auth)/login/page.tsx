import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <AuthShell
      tone="patient"
      heading="Your lab tests, booked in minutes."
      points={[
        "Compare prices for the same test across centres in your city",
        "Pick a time slot that suits you, up to two weeks ahead",
        "Pay by card or UPI and track every booking in one place",
      ]}
      title="Welcome back"
      subtitle="Sign in to book tests and manage your appointments."
      footer={
        <div className="space-y-2">
          <p>
            New to EVE?{" "}
            <Link href="/signup" className="font-medium text-primary hover:underline">
              Create an account
            </Link>
          </p>
          <p>
            Run a lab or centre?{" "}
            <Link href="/business/login" className="font-medium text-primary hover:underline">
              Business sign in
            </Link>
          </p>
        </div>
      }
    >
      <Suspense>
        <LoginForm demoAccounts={[{ email: "client@demo.eve", label: "Demo patient" }]} />
      </Suspense>
    </AuthShell>
  );
}
