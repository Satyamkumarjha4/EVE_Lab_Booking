import { Badge } from "@/components/ui/badge";
import type { BookingStatus } from "@/lib/types";

const VARIANT: Record<BookingStatus, string> = {
  PENDING: "bg-amber-100 text-amber-800 hover:bg-amber-100",
  CONFIRMED: "bg-green-100 text-green-800 hover:bg-green-100",
  FAILED: "bg-red-100 text-red-800 hover:bg-red-100",
  CANCELLED: "bg-gray-200 text-gray-700 hover:bg-gray-200",
};

export function StatusBadge({ status }: { status: BookingStatus }) {
  return <Badge className={VARIANT[status]}>{status}</Badge>;
}
