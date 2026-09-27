import type { Metadata } from "next";

import { CentreDetail } from "@/components/catalog/centre-detail";

export const metadata: Metadata = { title: "Centre" };

export default function CentreDetailPage() {
  return <CentreDetail />;
}
