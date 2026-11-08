import type { DraftRange } from "@/lib/calendar/draft-drag";
import type { CalendarEventItem } from "@/lib/calendar/layout";
import type { BusyGridItem } from "./busy-block";
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
  busy,
}: {
  /** Other people's busy times (spec 020 RF-8). */
  busy?: BusyGridItem[];
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
      busy={busy}
    />
  );
}
