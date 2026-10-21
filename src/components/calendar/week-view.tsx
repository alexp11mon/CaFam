import type { CalendarEventItem } from "@/lib/calendar/layout";
import { TimeGrid } from "./time-grid";

/** Seven days, Monday first (RF-29). */
export function WeekView(props: {
  days: string[];
  events: CalendarEventItem[];
  timeZone: string;
  today: string;
}) {
  return <TimeGrid {...props} linkDays />;
}
