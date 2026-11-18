"use client";

import { Button } from "@/components/ui/button";
import { formatDateKeyFull } from "@/lib/calendar/format";
import { visibleMarks } from "@/lib/calendar/month-marks";
import { getVisibleRange } from "@/lib/calendar/ranges";
import { parseDateKey } from "@/lib/calendar/time-zone";
import { yearMonths, yearOf } from "@/lib/calendar/year";
import { useYearMarks, type LoadYearMarks } from "@/lib/hooks/use-year-marks";
import { CalendarLink } from "./calendar-nav";

const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];

const monthName = new Intl.DateTimeFormat("es-ES", {
  month: "long",
  timeZone: "UTC",
});

/**
 * The 12 months of the year, with a dot per calendar on the days with events;
 * a day opens the day view, a month's name the month view (spec 042 RF-1 to RF-3).
 */
export function YearView({
  date,
  today,
  colors,
  visibleCalendarIds,
  loadYearMarks,
}: {
  date: string;
  today: string;
  colors: Record<string, string>;
  visibleCalendarIds: ReadonlySet<string>;
  loadYearMarks?: LoadYearMarks;
}) {
  const { marks, failed, retry } = useYearMarks(yearOf(date), loadYearMarks);
  const shown = visibleMarks(marks ?? {}, visibleCalendarIds);

  return (
    <div className="flex flex-col gap-3">
      {failed ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-danger bg-paper px-4 py-3 text-danger"
        >
          <span>No se han podido cargar los días con eventos.</span>
          <Button variant="secondary" onClick={retry}>
            Reintentar
          </Button>
        </div>
      ) : null}
      <div
        data-testid="year-grid"
        aria-busy={marks === undefined && !failed}
        className="grid grid-cols-1 gap-3 tab:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      >
        {yearMonths(date).map((month) => {
          const days = getVisibleRange("month", `${month}-01`, "UTC").days;
          const weeks = Array.from({ length: days.length / 7 }, (_, index) =>
            days.slice(index * 7, index * 7 + 7),
          );
          const name = monthName.format(new Date(`${month}-01T00:00:00Z`));
          return (
            <section
              key={month}
              aria-label={name}
              className="flex flex-col gap-1 rounded-card surface p-2 sm:p-3"
            >
              <h2>
                <CalendarLink
                  view="month"
                  date={`${month}-01`}
                  className="press-quiet inline-flex min-h-11 items-center rounded-control px-2 text-base font-semibold text-ink first-letter:uppercase hover:bg-stone focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                >
                  {name}
                </CalendarLink>
              </h2>
              <table className="w-full table-fixed text-center">
                <thead>
                  <tr>
                    {WEEKDAYS.map((weekday) => (
                      <th
                        key={weekday}
                        scope="col"
                        className="pb-1 text-xs font-semibold text-muted"
                      >
                        {weekday}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {weeks.map((week) => (
                    <tr key={week[0]}>
                      {week.map((day) => {
                        // Days of the next or previous month stay blank.
                        if (!day.startsWith(month)) {
                          return <td key={day} className="p-0" />;
                        }
                        const isToday = day === today;
                        const dots = shown[day] ?? [];
                        return (
                          <td key={day} className="p-0">
                            <CalendarLink
                              view="day"
                              date={day}
                              aria-label={`${formatDateKeyFull(day)}${isToday ? ", hoy" : ""}${dots.length > 0 ? ", con eventos" : ""}`}
                              aria-current={isToday ? "date" : undefined}
                              className={`press-quiet mx-auto flex size-11 flex-col items-center justify-center rounded-control text-sm tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                                isToday
                                  ? "border border-accent-edge bg-accent font-bold text-on-accent"
                                  : "font-medium text-ink hover:bg-stone"
                              }`}
                            >
                              {parseDateKey(day)?.day}
                              <span
                                aria-hidden="true"
                                className="flex h-1.5 gap-0.5"
                              >
                                {dots.map((calendarId) => (
                                  <span
                                    key={calendarId}
                                    data-dot=""
                                    className="size-1.5 rounded-full ring-1 ring-pastel-ink/20"
                                    style={{
                                      backgroundColor: colors[calendarId],
                                    }}
                                  />
                                ))}
                              </span>
                            </CalendarLink>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          );
        })}
      </div>
    </div>
  );
}
