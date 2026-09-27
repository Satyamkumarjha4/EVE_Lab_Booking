"use client";

import { PageHeader } from "@/components/common/page-header";
import { useDashboard } from "@/components/dashboard/dashboard-context";

import { SlotManager } from "./slot-manager";

/** Centre staff's own schedule editor. */
export function CentreSlots() {
  const { user } = useDashboard();
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Slots"
        description="Set when your centre takes appointments and how many patients fit in each 30-minute slot. Patients only see slots with places left."
      />
      {user.centre && <SlotManager centreId={user.centre} readOnly={false} />}
    </div>
  );
}
