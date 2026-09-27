import type { Metadata } from "next";
import { Suspense } from "react";

import { TestsBrowser } from "@/components/catalog/tests-browser";

export const metadata: Metadata = { title: "Find a lab test" };

export default function TestsPage() {
  return (
    <Suspense>
      <TestsBrowser />
    </Suspense>
  );
}
