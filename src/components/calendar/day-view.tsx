import type { DraftRange } from "@/lib/calendar/draft-drag";
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
  duration,
  onDraftChange,
}: {
  duration?: number;
  day: string;
  events: CalendarEventItem[];
  timeZone: string;
  today: string;
  onCreate?: CreateInGrid;
  draft?: GridDraft | null;
  onDraftChange?: (range: DraftRange) => void;
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
      duration={duration}
      onDraftChange={onDraftChange}
    />
  );
}
