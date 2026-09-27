"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { useAuth } from "@/lib/auth-context";
import { homeFor } from "@/lib/roles";
import type { Role } from "@/lib/types";

/**
 * Renders children only for a signed-in user whose role is in `roles`. Anonymous visitors go to
 * the matching login page (and come back afterwards); signed-in users with the wrong role go to
 * their own home.
 */
export function RequireAuth({
  roles,
  loginPath = "/login",
  children,
}: {
  roles: Role[];
  loginPath?: string;
  children: ReactNode;
}) {
  const { user, status } = useAuth();
  const router = useRouter();
  const allowed = !!user && roles.includes(user.role);

  useEffect(() => {
    if (status === "anonymous") {
      const here = window.location.pathname + window.location.search;
      router.replace(`${loginPath}?next=${encodeURIComponent(here)}`);
    } else if (user && !roles.includes(user.role)) {
      router.replace(homeFor(user));
    }
  }, [status, user, roles, router, loginPath]);

  if (!allowed) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground">
        <Loader2 className="size-5 animate-spin" aria-label="Loading" />
      </div>
    );
  }
  return <>{children}</>;
}
