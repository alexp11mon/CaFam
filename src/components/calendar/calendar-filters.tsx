"use client";

import { useId } from "react";
import { Avatar } from "@/components/people/avatar";
import { Button } from "@/components/ui/button";
import { ORPHAN_GROUP_ID, type PersonGroup } from "@/lib/calendar/grouping";
import { assignTints } from "@/lib/people/avatar";
import type { PanelCalendar } from "./calendar-workspace";

export interface FilterCategory {
  id: string;
  name: string;
  calendarId: string;
}

type Direction = "up" | "down";

function MoveButtons({
  kind,
  id,
  name,
  index,
  count,
  onMove,
}: {
  kind: "person" | "calendar";
  id: string;
  name: string;
  index: number;
  count: number;
  onMove: (
    kind: "person" | "calendar",
    id: string,
    direction: Direction,
  ) => void;
}) {
  return (
    <span className="flex shrink-0 gap-1">
      <Button
        variant="secondary"
        data-move={`${kind}:${id}:up`}
        aria-label={`Subir ${name}`}
        disabled={index === 0}
        onClick={() => onMove(kind, id, "up")}
        className="min-w-11 px-2"
      >
        <span aria-hidden="true">↑</span>
      </Button>
      <Button
        variant="secondary"
        data-move={`${kind}:${id}:down`}
        aria-label={`Bajar ${name}`}
        disabled={index === count - 1}
        onClick={() => onMove(kind, id, "down")}
        className="min-w-11 px-2"
      >
        <span aria-hidden="true">↓</span>
      </Button>
    </span>
  );
}

function PersonCheckbox({
  name,
  tint,
  calendars,
  onChange,
}: {
  name: string;
  tint: string;
  calendars: { visible: boolean }[];
  onChange: (visible: boolean) => void;
}) {
  const visibleCount = calendars.filter((calendar) => calendar.visible).length;
  const all = calendars.length > 0 && visibleCount === calendars.length;
  const some = visibleCount > 0 && !all;

  return (
    <label className="flex min-h-11 min-w-0 items-center gap-2 font-semibold text-ink">
      <input
        type="checkbox"
        checked={all}
        disabled={calendars.length === 0}
        ref={(input) => {
          if (input) input.indeterminate = some;
        }}
        onChange={() => onChange(!all)}
        className="size-5 shrink-0 accent-ink"
      />
      <Avatar name={name} tint={tint} />
      <span className="min-w-0 break-words">{name}</span>
    </label>
  );
}

/**
 * Tree of people, their calendars and the categories of each: show/hide with
 * checkboxes and reorder with up/down buttons (RF-32, RF-42..RF-45).
 */
export function CalendarFilters({
  groups,
  categories,
  hiddenCategories,
  onToggleCalendar,
  onTogglePerson,
  onToggleCategory,
  onMove,
}: {
  groups: (PersonGroup<PanelCalendar> & {
    calendars: { visible: boolean }[];
  })[];
  categories: FilterCategory[];
  hiddenCategories: ReadonlySet<string>;
  onToggleCalendar: (calendarId: string, visible: boolean) => void;
  onTogglePerson: (personId: string, visible: boolean) => void;
  onToggleCategory: (categoryId: string, visible: boolean) => void;
  onMove: (
    kind: "person" | "calendar",
    id: string,
    direction: Direction,
  ) => void;
}) {
  const headingId = useId();
  // With nobody else sharing, the person level would only repeat my own name.
  const showPeople = groups.length > 1;
  // Same tint for a person everywhere, whatever the saved order (spec 005 RF-28).
  const tints = assignTints(groups.map((group) => group.person.id));
  // The group without owner stays last: only real people move (spec 006 RF-22).
  const movableCount = groups.filter(
    (group) => group.person.id !== ORPHAN_GROUP_ID,
  ).length;

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-3 rounded-3xl bg-paper p-3"
    >
      <h2 id={headingId} className="text-base font-semibold text-ink">
        Calendarios
      </h2>
      <ul className="flex flex-col gap-3">
        {groups.map((group, groupIndex) => (
          <li key={group.person.id} className="flex flex-col">
            {showPeople ? (
              <div className="flex items-center justify-between gap-2">
                <PersonCheckbox
                  name={group.person.displayName}
                  tint={tints.get(group.person.id)!}
                  calendars={group.calendars}
                  onChange={(visible) =>
                    onTogglePerson(group.person.id, visible)
                  }
                />
                {group.person.id === ORPHAN_GROUP_ID ? null : (
                  <MoveButtons
                    kind="person"
                    id={group.person.id}
                    name={group.person.displayName}
                    index={groupIndex}
                    count={movableCount}
                    onMove={onMove}
                  />
                )}
              </div>
            ) : null}
            <ul className={showPeople ? "ml-3 border-l border-line pl-3" : ""}>
              {group.calendars.map((calendar, calendarIndex) => {
                const calendarCategories = categories.filter(
                  (category) => category.calendarId === calendar.id,
                );
                return (
                  <li key={calendar.id} className="flex flex-col">
                    <div className="flex items-center justify-between gap-2">
                      <label className="flex min-h-11 min-w-0 items-center gap-2 text-ink">
                        <input
                          type="checkbox"
                          checked={calendar.visible}
                          onChange={() =>
                            onToggleCalendar(calendar.id, !calendar.visible)
                          }
                          className="size-5 shrink-0 accent-ink"
                        />
                        <span
                          aria-hidden="true"
                          className="size-3 shrink-0 rounded-full ring-1 ring-ink/20"
                          style={{ backgroundColor: calendar.color }}
                        />
                        <span className="min-w-0 break-words">
                          {calendar.name}
                        </span>
                      </label>
                      <MoveButtons
                        kind="calendar"
                        id={calendar.id}
                        name={calendar.name}
                        index={calendarIndex}
                        count={group.calendars.length}
                        onMove={onMove}
                      />
                    </div>
                    {calendarCategories.length > 0 ? (
                      <ul className="ml-7">
                        {calendarCategories.map((category) => (
                          <li key={category.id}>
                            <label className="flex min-h-11 items-center gap-2 text-sm text-ink">
                              <input
                                type="checkbox"
                                checked={!hiddenCategories.has(category.id)}
                                onChange={(event) =>
                                  onToggleCategory(
                                    category.id,
                                    event.target.checked,
                                  )
                                }
                                className="size-5 shrink-0 accent-ink"
                              />
                              <span className="min-w-0 break-words">
                                {category.name}
                              </span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}
