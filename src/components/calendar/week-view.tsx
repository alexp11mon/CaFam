import type { DraftRange } from "@/lib/calendar/draft-drag";
import type { CalendarEventItem } from "@/lib/calendar/layout";
import type { BusyGridItem } from "./busy-block";
import { TimeGrid, type CreateInGrid, type GridDraft } from "./time-grid";

/** Seven days, Monday first (RF-29). */
export function WeekView(props: {
  days: string[];
  events: CalendarEventItem[];
  timeZone: string;
  today: string;
  onCreate?: CreateInGrid;
  draft?: GridDraft | null;
  onDraftChange?: (range: DraftRange) => void;
  duration?: number;
  /** Other people's busy times (spec 020 RF-8). */
  busy?: BusyGridItem[];
}) {
  return <TimeGrid {...props} linkDays />;
}
