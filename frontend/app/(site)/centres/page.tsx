import type { Metadata } from "next";
import { Suspense } from "react";

import { CentresBrowser } from "@/components/catalog/centres-browser";

export const metadata: Metadata = { title: "Diagnostic centres" };

export default function CentresPage() {
  return (
    <Suspense>
      <CentresBrowser />
    </Suspense>
  );
}
