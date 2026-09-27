"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { Logo } from "@/components/common/logo";
import { UserMenu } from "@/components/site/user-menu";
import { buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/lib/auth-context";
import { isBusiness } from "@/lib/roles";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/tests", label: "Find tests" },
  { href: "/centres", label: "Centres" },
];

export function SiteHeader() {
  const { user, status } = useAuth();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const links = user?.role === "CLIENT" ? [...NAV, { href: "/account/bookings", label: "My bookings" }] : NAV;
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="no-print sticky top-0 z-40 border-b bg-card/90 backdrop-blur supports-backdrop-filter:bg-card/75">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                isActive(link.href) && "bg-secondary text-secondary-foreground"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {status === "restoring" ? null : user ? (
            <>
              {isBusiness(user) && (
                <Link href="/dashboard" className={cn(buttonVariants({ size: "sm" }), "hidden sm:inline-flex")}>
                  Open dashboard
                </Link>
              )}
              <UserMenu user={user} />
            </>
          ) : (
            <>
              <Link
                href="/business/login"
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "hidden lg:inline-flex")}
              >
                For labs &amp; centres
              </Link>
              <Link
                href="/login"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "hidden sm:inline-flex")}
              >
                Sign in
              </Link>
              <Link href="/signup" className={buttonVariants({ size: "sm" })}>
                Sign up
              </Link>
            </>
          )}

          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger
              className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "md:hidden")}
              aria-label="Open menu"
            >
              <Menu />
            </SheetTrigger>
            <SheetContent side="right" className="p-6">
              <SheetTitle>Menu</SheetTitle>
              <nav className="mt-2 flex flex-col gap-1" aria-label="Mobile">
                {[
                  ...links,
                  ...(user ? [] : [
                    { href: "/login", label: "Sign in" },
                    { href: "/business/login", label: "For labs & centres" },
                  ]),
                  ...(isBusiness(user) ? [{ href: "/dashboard", label: "Dashboard" }] : []),
                ].map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className="rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-muted"
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
