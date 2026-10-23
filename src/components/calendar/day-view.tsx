import type { CalendarEventItem } from "@/lib/calendar/layout";
import { TimeGrid, type CreateInGrid, type GridDraft } from "./time-grid";

/** A single day (RF-29, RF-37). */
export function DayView({
  day,
  events,
  timeZone,
  today,
  onCreate,
  draft,
}: {
  day: string;
  events: CalendarEventItem[];
  timeZone: string;
  today: string;
  onCreate?: CreateInGrid;
  draft?: GridDraft | null;
}) {
  return (
    <TimeGrid
      days={[day]}
      events={events}
      timeZone={timeZone}
      today={today}
      linkDays={false}
      onCreate={onCreate}
      draft={draft}
    />
  );
}
