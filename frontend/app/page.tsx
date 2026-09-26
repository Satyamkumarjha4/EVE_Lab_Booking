"use client";

import { useEffect, useState } from "react";

import { CentreCard } from "@/components/centre-card";
import { listCentres } from "@/lib/api";
import type { Centre } from "@/lib/types";

export default function CatalogPage() {
  const [centres, setCentres] = useState<Centre[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listCentres()
      .then(setCentres)
      .catch(() => setError("Could not load centres. Is the backend running?"));
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Diagnostic centres</h1>
        <p className="text-sm text-muted-foreground">
          Browse centres and their available tests.
        </p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!error && centres === null && (
        <p className="text-sm text-muted-foreground">Loading…</p>
      )}
      {centres?.length === 0 && (
        <p className="text-sm text-muted-foreground">No centres available yet.</p>
      )}
      <div className="space-y-3">
        {centres?.map((centre) => (
          <CentreCard key={centre.id} centre={centre} />
        ))}
      </div>
    </div>
  );
}
