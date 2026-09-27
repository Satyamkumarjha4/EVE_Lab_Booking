"use client";

import { CalendarCheck, LayoutDashboard, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth-context";
import { isBusiness, ROLE_LABEL } from "@/lib/roles";
import type { Me } from "@/lib/types";

export function initials(email: string) {
  return email.slice(0, 2).toUpperCase();
}

export function UserMenu({ user }: { user: Me }) {
  const { logout } = useAuth();
  const router = useRouter();
  const business = isBusiness(user);

  function signOut() {
    logout();
    router.push(business ? "/business/login" : "/");
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" className="h-9 gap-2 px-1.5" aria-label="Account menu" />}
      >
        <span className="flex size-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
          {initials(user.email)}
        </span>
        <span className="hidden max-w-40 truncate text-sm font-normal md:inline">{user.email}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <p className="truncate text-sm font-medium text-foreground">{user.email}</p>
            <p className="text-xs font-normal">{ROLE_LABEL[user.role]}</p>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {business ? (
          <DropdownMenuItem onClick={() => router.push("/dashboard")}>
            <LayoutDashboard /> Dashboard
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={() => router.push("/account/bookings")}>
            <CalendarCheck /> My bookings
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut}>
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
