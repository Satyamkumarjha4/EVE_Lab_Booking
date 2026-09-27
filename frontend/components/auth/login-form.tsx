"use client";

import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { homeFor, isBusiness } from "@/lib/roles";
import type { Me } from "@/lib/types";

const DEMO_PASSWORD = "EveDemo@2026";

export interface DemoAccount {
  email: string;
  label: string;
}

/** Only follow same-site relative redirects, and only into the area the user's role can open. */
function safeNext(next: string | null, user: Me) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return homeFor(user);
  const businessPath = next.startsWith("/dashboard");
  return businessPath === isBusiness(user) ? next : homeFor(user);
}

export function LoginForm({ demoAccounts }: { demoAccounts: DemoAccount[] }) {
  const { login } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function signIn(emailValue: string, passwordValue: string) {
    setError(null);
    setSubmitting(true);
    try {
      const user = await login(emailValue, passwordValue);
      router.replace(safeNext(params.get("next"), user));
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 401
          ? "That email and password don't match an account."
          : errorMessage(err, "Couldn't sign you in. Please try again.")
      );
      setSubmitting(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    signIn(email, password);
  }

  function signInAsDemo(account: DemoAccount) {
    setEmail(account.email);
    setPassword(DEMO_PASSWORD);
    signIn(account.email, DEMO_PASSWORD);
  }

  return (
    <div className="space-y-6">
      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            className="h-10"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              className="h-10 pr-10"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>
        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        )}
        <Button type="submit" className="h-10 w-full" disabled={submitting}>
          {submitting && <Loader2 className="animate-spin" />}
          {submitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      {demoAccounts.length > 0 && (
        <div className="rounded-xl border border-dashed bg-muted/40 p-4">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Demo accounts
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {demoAccounts.map((account) => (
              <Button
                key={account.email}
                type="button"
                variant="outline"
                size="sm"
                disabled={submitting}
                onClick={() => signInAsDemo(account)}
              >
                {account.label}
              </Button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            One click signs in with the seeded demo login (password {DEMO_PASSWORD}).
          </p>
        </div>
      )}
    </div>
  );
}
