import { useId } from "react";
import { T } from "@/components/i18n/locale-provider";
import type { CalendarView } from "@/lib/calendar/ranges";

const BLOCK = "rounded-control bg-paper motion-safe:animate-pulse";

/**
 * What the calendar looks like while its events load, instead of an empty
 * screen (spec 008 RF-33, plan calendar-skeleton). Purely decorative but for
 * the status that screen readers hear.
 */
export function CalendarSkeleton({ view }: { view: CalendarView }) {
  // aria-label must be a string; the label is a translated hidden span (spec 053).
  const id = useId();
  return (
    <div
      role="status"
      aria-busy="true"
      aria-labelledby={id}
      className="flex flex-col gap-4"
    >
      <span id={id} hidden>
        <T>{"Cargando calendario…"}</T>
      </span>
      {/* On a phone the header replaces the toolbar (spec 016 RF-19). */}
      <div aria-hidden="true" className="flex gap-2 max-tab:hidden">
        <div className={`h-11 w-20 ${BLOCK}`} />
        <div className={`h-11 w-24 ${BLOCK}`} />
        <div className={`h-11 w-48 ${BLOCK}`} />
      </div>
      <div aria-hidden="true" className="flex flex-col gap-4 lg:flex-row">
        <div className={`hidden h-96 lg:block lg:w-84 lg:shrink-0 ${BLOCK}`} />
        <div className="min-w-0 flex-1">
          {view === "agenda" ? (
            // The month band and a few days, as the agenda (spec 016 RF-50).
            <div className="flex flex-col gap-3">
              <div className={`h-28 ${BLOCK}`} />
              {Array.from({ length: 4 }, (_, index) => (
                <div
                  key={index}
                  data-testid="skeleton-agenda-row"
                  className={`ml-14 h-14 ${BLOCK}`}
                />
              ))}
            </div>
          ) : view === "month" ? (
            // The month's full height, as the view it stands for (spec 016 RF-30).
            <div className="grid h-calendar grid-cols-7 grid-rows-5 gap-1 tab:h-[max(32rem,calc(100dvh-18rem))]">
              {Array.from({ length: 35 }, (_, index) => (
                <div
                  key={index}
                  data-testid="skeleton-month-cell"
                  className={BLOCK}
                />
              ))}
            </div>
          ) : (
            <div className="flex h-calendar gap-1 tab:h-[max(32rem,calc(100dvh-18rem))]">
              {Array.from(
                { length: view === "week" ? 7 : view === "4days" ? 4 : 1 },
                (_, index) => (
                  <div
                    key={index}
                    data-testid="skeleton-grid-column"
                    className={`flex-1 ${BLOCK}`}
                  />
                ),
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
