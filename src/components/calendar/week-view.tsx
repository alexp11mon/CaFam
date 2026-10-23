import type { CalendarEventItem } from "@/lib/calendar/layout";
import { TimeGrid, type CreateInGrid, type GridDraft } from "./time-grid";

/** Seven days, Monday first (RF-29). */
export function WeekView(props: {
  days: string[];
  events: CalendarEventItem[];
  timeZone: string;
  today: string;
  onCreate?: CreateInGrid;
  draft?: GridDraft | null;
}) {
  return <TimeGrid {...props} linkDays />;
}
