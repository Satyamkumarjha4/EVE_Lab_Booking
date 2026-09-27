"use client";

import {
  Building2,
  CalendarRange,
  Clock4,
  ExternalLink,
  LayoutDashboard,
  Menu,
  Tags,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

import { Logo } from "@/components/common/logo";
import { DashboardProvider, useDashboard } from "@/components/dashboard/dashboard-context";
import { UserMenu } from "@/components/site/user-menu";
import { buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/lib/auth-context";
import { ROLE_LABEL } from "@/lib/roles";
import type { Me, Role } from "@/lib/types";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: Role[];
}

// Centre staff run the desk (walk-ins, slots); the lab owns prices and its centres.
const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["LAB", "CENTRE", "PLATFORM_ADMIN"] },
  { href: "/dashboard/bookings", label: "Bookings", icon: CalendarRange, roles: ["LAB", "CENTRE", "PLATFORM_ADMIN"] },
  { href: "/dashboard/walk-in", label: "Walk-in booking", icon: UserPlus, roles: ["CENTRE"] },
  { href: "/dashboard/catalog", label: "Tests & pricing", icon: Tags, roles: ["LAB", "CENTRE"] },
  { href: "/dashboard/slots", label: "Slots", icon: Clock4, roles: ["CENTRE"] },
  { href: "/dashboard/centres", label: "Centres", icon: Building2, roles: ["LAB"] },
];

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { user, scopeLabel } = useDashboard();
  const pathname = usePathname();
  const items = NAV.filter((item) => item.roles.includes(user.role));
  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 py-5">
        <Logo href="/dashboard" suffix="Business" />
      </div>
      <div className="mx-3 mb-4 rounded-lg border bg-muted/40 px-3 py-2.5">
        <p className="text-xs text-muted-foreground">{ROLE_LABEL[user.role]}</p>
        <p className="truncate text-sm font-medium" title={scopeLabel}>{scopeLabel}</p>
      </div>
      <nav className="flex-1 space-y-1 px-3" aria-label="Dashboard">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={isActive(item.href) ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              isActive(item.href) && "bg-secondary text-secondary-foreground hover:bg-secondary"
            )}
          >
            <item.icon className="size-4" aria-hidden />
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="border-t p-3">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ExternalLink className="size-4" aria-hidden /> Patient website
        </Link>
      </div>
    </div>
  );
}

function Shell({ user, children }: { user: Me; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-screen bg-background">
      <aside className="no-print sticky top-0 hidden h-screen w-64 shrink-0 border-r bg-sidebar lg:block">
        <SidebarNav />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-card/90 px-4 backdrop-blur sm:px-6">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "lg:hidden")}
              aria-label="Open navigation"
            >
              <Menu />
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0" showCloseButton={false}>
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <SidebarNav onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
          <div className="ml-auto">
            <UserMenu user={user} />
          </div>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

export function DashboardShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  // Rendered inside RequireAuth, so a user is always present here.
  if (!user) return null;
  return (
    <DashboardProvider user={user}>
      <Shell user={user}>{children}</Shell>
    </DashboardProvider>
  );
}
