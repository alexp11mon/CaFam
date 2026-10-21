import type { CalendarEventItem } from "@/lib/calendar/layout";
import { TimeGrid } from "./time-grid";

/** A single day (RF-29, RF-37). */
export function DayView({
  day,
  events,
  timeZone,
  today,
}: {
  day: string;
  events: CalendarEventItem[];
  timeZone: string;
  today: string;
}) {
  return (
    <TimeGrid
      days={[day]}
      events={events}
      timeZone={timeZone}
      today={today}
      linkDays={false}
    />
  );
}
