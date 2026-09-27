import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = { title: "Create an account" };

export default function SignupPage() {
  return (
    <AuthShell
      tone="patient"
      heading="Healthcare that fits around your day."
      points={[
        "Transparent, centre-specific prices before you book",
        "Morning to evening slots at centres near you",
        "Cancel a booking anytime before your visit",
      ]}
      title="Create your account"
      subtitle="It takes less than a minute. You'll be signed in right away."
      footer={
        <p>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      }
    >
      <Suspense>
        <SignupForm />
      </Suspense>
    </AuthShell>
  );
}
