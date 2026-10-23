"use client";

import { useEffect, useId, useRef, useState } from "react";
import { FormAlert } from "@/components/ui/form-alert";
import { CALENDAR_MESSAGES } from "@/lib/calendar/error-messages";
import {
  ORPHAN_GROUP_ID,
  type GroupableCalendar,
  type PersonGroup,
} from "@/lib/calendar/grouping";
import type { CalendarView } from "@/lib/calendar/ranges";
import { AgendaView, type AgendaEvent } from "./agenda-view";
import type { MonthMarks } from "@/lib/calendar/month-marks";
import { CalendarFilters, type FilterCategory } from "./calendar-filters";
import { DayView } from "./day-view";
import { MiniMonth } from "./mini-month";
import { MonthView } from "./month-view";
import { NextEventCard, type NextEventItem } from "./next-event-card";
import { WeekView } from "./week-view";

export interface PanelCalendar extends GroupableCalendar {
  color: string;
}

type Group = PersonGroup<PanelCalendar>;
type Result = { error?: string };
type Direction = "up" | "down";

export interface SavedOrder {
  people: string[];
  calendars: Record<string, string[]>;
}

function orderOf(groups: Group[]): SavedOrder {
  return {
    // The group without owner is not a person: its position is never saved (spec 006 RF-22).
    people: groups
      .map((group) => group.person.id)
      .filter((id) => id !== ORPHAN_GROUP_ID),
    calendars: Object.fromEntries(
      groups.map((group) => [
        group.person.id,
        group.calendars.map((calendar) => calendar.id),
      ]),
    ),
  };
}

function swap<T>(items: T[], index: number, direction: Direction): T[] {
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}

/**
 * The calendar page below the toolbar: filter panel plus the chosen view. Visibility
 * and order change at once in the browser and are saved in the background; if saving
 * fails the change is undone and the error shown (RF-32, RF-33, RF-43..RF-46).
 */
export function CalendarWorkspace({
  view,
  date,
  days,
  today,
  timeZone,
  events,
  canCreate = false,
  groups: initialGroups,
  categories,
  setCalendarVisibility,
  setPersonVisibility,
  saveOrder,
  nextEvents,
  loadedAt,
  monthMarks,
  loadMonthMarks,
}: {
  view: CalendarView;
  date: string;
  days: string[];
  today: string;
  timeZone: string;
  events: AgendaEvent[];
  /** At least one calendar the user can add events to (spec 005 RF-38). */
  canCreate?: boolean;
  groups: Group[];
  categories: FilterCategory[];
  setCalendarVisibility: (id: string, visible: boolean) => Promise<Result>;
  setPersonVisibility: (id: string, visible: boolean) => Promise<Result>;
  saveOrder: (order: SavedOrder) => Promise<Result>;
  /** Timed events of the next 48 h and when they were read (spec 005 RF-45, plan D12). */
  nextEvents?: NextEventItem[];
  loadedAt?: number;
  /** Dots of the month of `date` and how to read another month (spec 005 RF-24, RF-26). */
  monthMarks?: MonthMarks;
  loadMonthMarks?: (
    month: string,
  ) => Promise<{ marks: MonthMarks } | { error: string }>;
}) {
  const [groups, setGroups] = useState(initialGroups);
  const [hiddenCategories, setHiddenCategories] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [error, setError] = useState<string>();
  const [panelOpen, setPanelOpen] = useState(false);
  const panelId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<string | null>(null);

  // Adopt fresh server data (after a revalidation) as the new starting point.
  const [seen, setSeen] = useState(initialGroups);
  if (seen !== initialGroups) {
    setSeen(initialGroups);
    setGroups(initialGroups);
  }

  // After a move the button may have been re-created or disabled: give the focus back.
  useEffect(() => {
    const request = pendingFocus.current;
    if (!request) return;
    pendingFocus.current = null;
    const [kind, id, direction] = request.split(":") as [
      string,
      string,
      Direction,
    ];
    const find = (dir: Direction) =>
      panel.current?.querySelector<HTMLButtonElement>(
        `button[data-move="${kind}:${id}:${dir}"]:not(:disabled)`,
      );
    (find(direction) ?? find(direction === "up" ? "down" : "up"))?.focus();
  }, [groups]);

  async function apply(next: Group[], persist: () => Promise<Result>) {
    const previous = groups;
    setGroups(next);
    setError(undefined);
    let result: Result;
    try {
      result = await persist();
    } catch {
      result = { error: CALENDAR_MESSAGES.connection };
    }
    if (result.error) {
      setGroups(previous);
      setError(result.error);
    }
  }

  function toggleCalendar(calendarId: string, visible: boolean) {
    void apply(
      groups.map((group) => ({
        ...group,
        calendars: group.calendars.map((calendar) =>
          calendar.id === calendarId ? { ...calendar, visible } : calendar,
        ),
      })),
      () => setCalendarVisibility(calendarId, visible),
    );
  }

  function togglePerson(personId: string, visible: boolean) {
    void apply(
      groups.map((group) =>
        group.person.id === personId
          ? {
              ...group,
              calendars: group.calendars.map((calendar) => ({
                ...calendar,
                visible,
              })),
            }
          : group,
      ),
      personId === ORPHAN_GROUP_ID
        ? () => setGroupVisibility(personId, visible)
        : () => setPersonVisibility(personId, visible),
    );
  }

  // The group without owner has no person to filter by: save each calendar (spec 006 RF-22).
  async function setGroupVisibility(
    groupId: string,
    visible: boolean,
  ): Promise<Result> {
    const ids =
      groups
        .find((group) => group.person.id === groupId)
        ?.calendars.map((calendar) => calendar.id) ?? [];
    const results = await Promise.all(
      ids.map((id) => setCalendarVisibility(id, visible)),
    );
    return results.find((result) => result.error) ?? {};
  }

  function toggleCategory(categoryId: string, visible: boolean) {
    setHiddenCategories((current) => {
      const next = new Set(current);
      if (visible) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  }

  function move(kind: "person" | "calendar", id: string, direction: Direction) {
    const next =
      kind === "person"
        ? swap(
            groups,
            groups.findIndex((group) => group.person.id === id),
            direction,
          )
        : groups.map((group) => {
            const index = group.calendars.findIndex((c) => c.id === id);
            return index === -1
              ? group
              : {
                  ...group,
                  calendars: swap(group.calendars, index, direction),
                };
          });
    pendingFocus.current = `${kind}:${id}:${direction}`;
    void apply(next, () => saveOrder(orderOf(next)));
  }

  const visibleCalendars = new Set(
    groups.flatMap((group) =>
      group.calendars.filter((c) => c.visible).map((c) => c.id),
    ),
  );
  const shown = events.filter(
    (event) =>
      visibleCalendars.has(event.calendarId) &&
      !(event.categoryId && hiddenCategories.has(event.categoryId)),
  );

  const colors = Object.fromEntries(
    groups.flatMap((group) => group.calendars.map((c) => [c.id, c.color])),
  );

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-8">
      <div className="flex flex-col gap-3 lg:w-84 lg:shrink-0">
        {nextEvents && loadedAt !== undefined ? (
          <NextEventCard
            events={nextEvents}
            visibleCalendarIds={visibleCalendars}
            timeZone={timeZone}
            loadedAt={loadedAt}
          />
        ) : null}
        <button
          type="button"
          aria-expanded={panelOpen}
          aria-controls={panelId}
          onClick={() => setPanelOpen((open) => !open)}
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-control bg-paper px-4 text-base font-semibold text-ink transition-colors hover:bg-stone focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink lg:hidden"
        >
          Calendarios y filtros
        </button>
        <div
          id={panelId}
          ref={panel}
          className={`${panelOpen ? "flex" : "hidden"} flex-col gap-3 lg:flex`}
        >
          <FormAlert message={error} />
          {monthMarks && loadMonthMarks ? (
            <MiniMonth
              // A new month in the main view starts the mini month there again.
              key={date.slice(0, 7)}
              month={date.slice(0, 7)}
              today={today}
              view={view}
              initialMarks={monthMarks}
              colors={colors}
              visibleCalendarIds={visibleCalendars}
              loadMonthMarks={loadMonthMarks}
            />
          ) : null}
          <CalendarFilters
            groups={groups}
            categories={categories}
            hiddenCategories={hiddenCategories}
            onToggleCalendar={toggleCalendar}
            onTogglePerson={togglePerson}
            onToggleCategory={toggleCategory}
            onMove={move}
          />
        </div>
      </div>
      <div className="min-w-0 flex-1">
        {view === "agenda" ? (
          <AgendaView
            days={days}
            events={shown}
            timeZone={timeZone}
            today={today}
            canCreate={canCreate}
          />
        ) : view === "month" ? (
          <MonthView
            date={date}
            days={days}
            events={shown}
            timeZone={timeZone}
            today={today}
          />
        ) : view === "week" ? (
          <WeekView
            days={days}
            events={shown}
            timeZone={timeZone}
            today={today}
          />
        ) : (
          <DayView
            day={date}
            events={shown}
            timeZone={timeZone}
            today={today}
          />
        )}
      </div>
    </div>
  );
}
