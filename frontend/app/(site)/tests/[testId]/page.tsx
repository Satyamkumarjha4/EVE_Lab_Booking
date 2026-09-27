import type { Metadata } from "next";

import { TestDetail } from "@/components/catalog/test-detail";

export const metadata: Metadata = { title: "Compare test prices" };

export default function TestDetailPage() {
  return <TestDetail />;
}
