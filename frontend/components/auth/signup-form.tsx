"use client";

import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

const MIN_PASSWORD = 8;

export function SignupForm() {
  const { signup } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const mismatch = confirm.length > 0 && confirm !== password;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) return;
    setError(null);
    setSubmitting(true);
    try {
      await signup(email, password);
      const next = params.get("next");
      router.replace(next?.startsWith("/") && !next.startsWith("//") ? next : "/tests");
    } catch (err) {
      setError(errorMessage(err, "Couldn't create your account."));
      setSubmitting(false);
    }
  }

  return (
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
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD}
          className="h-10"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          At least {MIN_PASSWORD} characters, not only numbers, and not too similar to your email.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirm">Confirm password</Label>
        <Input
          id="confirm"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={mismatch}
          className="h-10"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        {mismatch && <p className="text-xs text-red-700">Passwords don&apos;t match.</p>}
      </div>
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
      <Button type="submit" className="h-10 w-full" disabled={submitting || mismatch}>
        {submitting && <Loader2 className="animate-spin" />}
        {submitting ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
