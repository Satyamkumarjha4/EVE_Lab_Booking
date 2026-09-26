"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { listCentreTests } from "@/lib/api";
import type { Centre, CentreTest } from "@/lib/types";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function CentreCard({ centre }: { centre: Centre }) {
  const [expanded, setExpanded] = useState(false);
  const [tests, setTests] = useState<CentreTest[] | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function toggle() {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (tests === null) {
      setLoading(true);
      try {
        setTests(await listCentreTests(centre.id));
      } finally {
        setLoading(false);
      }
    }
  }

  function book(centreTest: CentreTest) {
    const params = new URLSearchParams({
      centreTestId: String(centreTest.id),
      centreName: centre.name,
      testName: centreTest.test.name,
      price: centreTest.price,
    });
    router.push(`/book/new?${params.toString()}`);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{centre.name}</span>
          <Button variant="ghost" size="sm" onClick={toggle}>
            {expanded ? "Hide tests" : "View tests"}
          </Button>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {centre.location} · {centre.lab.name}
        </p>
      </CardHeader>
      {expanded && (
        <CardContent>
          {loading && <p className="text-sm text-muted-foreground">Loading tests…</p>}
          {!loading && tests?.length === 0 && (
            <p className="text-sm text-muted-foreground">No tests available.</p>
          )}
          <ul className="divide-y">
            {tests?.map((centreTest) => (
              <li key={centreTest.id} className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium">{centreTest.test.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {centreTest.test.description}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-medium">₹{centreTest.price}</span>
                  <Button size="sm" onClick={() => book(centreTest)}>
                    Book
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      )}
    </Card>
  );
}
