"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";

export function NavBar() {
  const { user, logout } = useAuth();
  const router = useRouter();

  function handleLogout() {
    logout();
    router.push("/login");
  }

  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
        <Link href="/" className="font-semibold">
          EVE Diagnostics
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/">Catalog</Link>
          {user && <Link href="/bookings">Bookings</Link>}
          {user ? (
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground">{user.email}</span>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                Log out
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link href="/login">Log in</Link>
              <Link href="/signup">Sign up</Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
