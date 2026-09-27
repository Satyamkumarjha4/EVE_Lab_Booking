"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

import { listCentres } from "@/lib/api";
import type { Centre, Me } from "@/lib/types";
import { useResource } from "@/lib/use-resource";

interface DashboardValue {
  user: Me;
  /** Centres this account manages (its lab's centres, its own centre, or all for admins). */
  centres: Centre[] | undefined;
  scopeLabel: string;
  reloadCentres: () => void;
}

const DashboardContext = createContext<DashboardValue | null>(null);

function managedBy(user: Me, centres: Centre[]) {
  if (user.role === "LAB") return centres.filter((c) => c.lab.id === user.lab);
  if (user.role === "CENTRE") return centres.filter((c) => c.id === user.centre);
  return centres;
}

export function DashboardProvider({ user, children }: { user: Me; children: ReactNode }) {
  const all = useResource(listCentres, `centres:${user.id}`);

  const value = useMemo<DashboardValue>(() => {
    const centres = all.data && managedBy(user, all.data);
    let scopeLabel = "All labs";
    if (user.role === "LAB") scopeLabel = centres?.[0]?.lab.name ?? "Your lab";
    if (user.role === "CENTRE") scopeLabel = centres?.[0]?.name ?? "Your centre";
    return { user, centres, scopeLabel, reloadCentres: all.reload };
  }, [all.data, all.reload, user]);

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboard must be used within a DashboardProvider");
  return ctx;
}
