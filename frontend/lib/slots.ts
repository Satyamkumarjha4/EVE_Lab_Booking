import { CENTRE_TIME_ZONE } from "./format";
import type { DaySlots } from "./types";

export type Period = "Morning" | "Afternoon" | "Evening";

export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** Hour of an ISO time on the centre's wall clock. */
function centreHour(iso: string) {
  const hour = new Intl.DateTimeFormat("en-GB", {
    timeZone: CENTRE_TIME_ZONE,
    hour: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
  return Number(hour);
}

export function periodOf(iso: string): Period {
  const hour = centreHour(iso);
  if (hour < 12) return "Morning";
  if (hour < 16) return "Afternoon";
  return "Evening";
}

/** "07:30:00" → "7:30 am" (rule times are already centre-local). */
export function clockLabel(time: string) {
  const [h, m] = time.split(":").map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });
}

/** The centre-local calendar date of an instant, as YYYY-MM-DD. */
export function centreDate(at: string | Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: CENTRE_TIME_ZONE }).format(new Date(at));
}

/** Today's date in the centre's time zone, as YYYY-MM-DD. */
export function centreToday() {
  return centreDate(new Date());
}

/** Local YYYY-MM-DD (no time zone shift) → readable day label. */
export function dayLabel(date: string, options: Intl.DateTimeFormatOptions) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", options);
}

export type DayState = "open" | "full" | "closed";

export function dayState(day: DaySlots): DayState {
  if (day.slots.every((s) => s.capacity === 0)) return "closed";
  return day.slots.some((s) => s.bookable) ? "open" : "full";
}
