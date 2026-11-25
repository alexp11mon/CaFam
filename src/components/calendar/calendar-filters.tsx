"use client";

import { useId, useState, type ReactNode } from "react";
import { Avatar } from "@/components/people/avatar";
import { ChevronIcon } from "@/components/shell/icons";
import { Button } from "@/components/ui/button";
import { FoldChevron } from "@/components/ui/fold-chevron";
import { IconButton } from "@/components/ui/icon-button";
import { useConnection } from "@/lib/hooks/use-connection";
import { foldId } from "@/lib/calendar/folded";
import { useFolded } from "@/lib/hooks/use-folded";
import { ORPHAN_GROUP_ID } from "@/lib/calendar/grouping";
import { assignTints } from "@/lib/people/avatar";
import type { FilterSection } from "./calendar-workspace";
import { useCalendarTasks } from "./task-block";
import { Switch } from "@/components/ui/switch";

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
        <ChevronIcon direction="up" />
      </Button>
      <Button
        variant="secondary"
        data-move={`${kind}:${id}:down`}
        aria-label={`Bajar ${name}`}
        disabled={index === count - 1}
        onClick={() => onMove(kind, id, "down")}
        className="min-w-11 px-2"
      >
        <ChevronIcon direction="down" />
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
  /** A person's avatar tint; a group of the user has no avatar (spec 007 RF-36). */
  tint?: string;
  calendars: { visible: boolean }[];
  onChange: (visible: boolean) => void;
}) {
  const visibleCount = calendars.filter((calendar) => calendar.visible).length;
  const all = calendars.length > 0 && visibleCount === calendars.length;
  const some = visibleCount > 0 && !all;

  return (
    <label className="press-quiet flex min-h-11 min-w-0 items-center gap-2 font-semibold text-ink">
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
      {tint ? <Avatar name={name} tint={tint} /> : null}
      <span className="min-w-0 break-words">{name}</span>
    </label>
  );
}

function FoldButton({
  open,
  name,
  controls,
  onToggle,
}: {
  open: boolean;
  name: string;
  controls: string;
  onToggle: () => void;
}) {
  return (
    <IconButton
      label={`${open ? "Plegar" : "Desplegar"} ${name}`}
      aria-expanded={open}
      aria-controls={controls}
      onClick={onToggle}
      className="-ml-2 text-muted"
    >
      <FoldChevron open={open} />
    </IconButton>
  );
}

function hiddenCategoriesText(count: number) {
  return count === 1 ? "1 categoría oculta" : `${count} categorías ocultas`;
}

function CalendarRow({
  calendar,
  index,
  count,
  categories,
  hiddenCategories,
  ordering,
  onToggleCalendar,
  onToggleCategory,
  onMove,
}: {
  calendar: FilterSection["calendars"][number];
  index: number;
  count: number;
  categories: FilterCategory[];
  hiddenCategories: ReadonlySet<string>;
  ordering: boolean;
  onToggleCalendar: (calendarId: string, visible: boolean) => void;
  onToggleCategory: (categoryId: string, visible: boolean) => void;
  onMove: (
    kind: "person" | "calendar",
    id: string,
    direction: Direction,
  ) => void;
}) {
  const listId = useId();
  // Categories start folded: most of the time only the calendar matters (RF-5).
  const [folded, setFolded] = useFolded(foldId.categories(calendar.id), true);
  const hidden = categories.filter((category) =>
    hiddenCategories.has(category.id),
  ).length;

  return (
    <li className="flex flex-col">
      <div className="flex items-center justify-between gap-2">
        <label className="flex min-h-11 min-w-0 items-center gap-2 text-ink">
          <input
            type="checkbox"
            checked={calendar.visible}
            onChange={() => onToggleCalendar(calendar.id, !calendar.visible)}
            className="size-5 shrink-0 accent-ink"
          />
          <span
            aria-hidden="true"
            className="size-3 shrink-0 rounded-full ring-1 ring-pastel-ink/20"
            style={{ backgroundColor: calendar.color }}
          />
          <span className="flex min-w-0 flex-col">
            <span className="min-w-0 break-words">{calendar.name}</span>
            {hidden > 0 ? (
              <span className="text-xs text-muted">
                {hiddenCategoriesText(hidden)}
              </span>
            ) : null}
          </span>
        </label>
        {ordering ? (
          <MoveButtons
            kind="calendar"
            id={calendar.id}
            name={calendar.name}
            index={index}
            count={count}
            onMove={onMove}
          />
        ) : categories.length > 0 ? (
          <IconButton
            label={`${folded ? "Mostrar" : "Ocultar"} las categorías de ${calendar.name}`}
            aria-expanded={!folded}
            aria-controls={listId}
            onClick={() => setFolded(!folded)}
            className="text-muted"
          >
            <FoldChevron open={!folded} />
          </IconButton>
        ) : null}
      </div>
      {categories.length > 0 ? (
        <ul id={listId} hidden={folded || ordering} className="ml-7">
          {categories.map((category) => (
            <li key={category.id}>
              <label className="flex min-h-11 items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={!hiddenCategories.has(category.id)}
                  onChange={(event) =>
                    onToggleCategory(category.id, event.target.checked)
                  }
                  className="size-5 shrink-0 accent-ink"
                />
                <span className="min-w-0 break-words">{category.name}</span>
              </label>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/** A person or group: its row folds the list of its calendars (RF-4). */
function SectionItem({
  group,
  showPeople,
  ordering,
  tint,
  move,
  children,
  onTogglePerson,
}: {
  group: FilterSection;
  showPeople: boolean;
  ordering: boolean;
  tint?: string;
  move: ReactNode;
  children: ReactNode;
  onTogglePerson: (personId: string, visible: boolean) => void;
}) {
  const listId = useId();
  const [folded, setFolded] = useFolded(
    group.groupId
      ? foldId.group(group.groupId)
      : foldId.person(group.person.id),
  );
  // Ordering unfolds everything to move, without saving it (plan D3).
  const open = !folded || ordering || !showPeople;
  const visible = group.calendars.filter((calendar) => calendar.visible).length;

  return (
    <li className="flex flex-col">
      {showPeople ? (
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center">
            {ordering ? null : (
              <FoldButton
                open={open}
                name={group.person.displayName}
                controls={listId}
                onToggle={() => setFolded(!folded)}
              />
            )}
            <PersonCheckbox
              name={group.person.displayName}
              tint={tint}
              calendars={group.calendars}
              onChange={(next) => onTogglePerson(group.person.id, next)}
            />
          </div>
          {ordering ? (
            move
          ) : (
            <span className="shrink-0 text-sm text-muted tabular-nums">
              <span aria-hidden="true">
                {visible}/{group.calendars.length}
              </span>
              <span className="sr-only">
                {visible} de {group.calendars.length} visibles
              </span>
            </span>
          )}
        </div>
      ) : null}
      <ul
        id={listId}
        hidden={!open}
        className={showPeople ? "ml-3 border-l border-line pl-3" : ""}
      >
        {children}
      </ul>
    </li>
  );
}

/**
 * Tree of people or groups, their calendars and the categories of each:
 * show/hide with checkboxes, fold what is not needed and, in "Ordenar",
 * reorder with up/down buttons (RF-32, RF-42..RF-45; spec 032 RF-3..RF-9).
 */
export function CalendarFilters({
  groups,
  categories,
  hiddenCategories,
  onToggleCalendar,
  onTogglePerson,
  onToggleCategory,
  onMove,
  tints: sharedTints,
}: {
  groups: FilterSection[];
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
  /** Tints shared with the busy blocks (spec 020 RF-9). */
  tints?: ReadonlyMap<string, string>;
}) {
  const headingId = useId();
  const listId = useId();
  const [folded, setFolded] = useFolded(foldId.calendars);
  const [ordering, setOrdering] = useState(false);
  // The export reads the server: not offline (spec 043 RF-2).
  const online = useConnection();
  // "Tareas con fecha", only inside the calendar (spec 048 RF-6).
  const tasks = useCalendarTasks();
  // With nobody else sharing, the person level would only repeat my own name.
  const showPeople = groups.length > 1;
  const people = groups.filter((group) => !group.groupId);
  // Same tint for a person everywhere, whatever the saved order (spec 005 RF-28).
  const tints =
    sharedTints ?? assignTints(people.map((group) => group.person.id));
  // Groups move among groups and people among people; the group without
  // owner stays last (spec 006 RF-22, spec 007 RF-38).
  const userGroups = groups.filter((group) => group.groupId);
  const movablePeople = people.filter(
    (group) => group.person.id !== ORPHAN_GROUP_ID,
  );
  const all = groups.flatMap((group) => group.calendars);
  const visible = all.filter((calendar) => calendar.visible).length;
  const canOrder =
    all.length > 1 || userGroups.length > 1 || movablePeople.length > 1;

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-2 rounded-card surface p-3"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id={headingId} className="min-w-0 text-base font-semibold text-ink">
          <button
            type="button"
            aria-expanded={!folded}
            aria-controls={listId}
            onClick={() => {
              setFolded(!folded);
              setOrdering(false);
            }}
            className="press-quiet -ml-1 flex min-h-11 items-center gap-1 rounded-control px-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <span className="text-muted">
              <FoldChevron open={!folded} />
            </span>
            Calendarios
          </button>
        </h2>
        {folded || !canOrder ? (
          <span className="text-sm text-muted tabular-nums">
            {visible} de {all.length} visibles
          </span>
        ) : (
          <Button
            variant="quiet"
            onClick={() => setOrdering(!ordering)}
            className="min-h-11 px-3 text-sm"
          >
            {ordering ? "Hecho" : "Ordenar"}
          </Button>
        )}
      </div>
      <ul id={listId} hidden={folded} className="flex flex-col gap-1">
        {groups.map((group) => (
          <SectionItem
            key={group.person.id}
            group={group}
            showPeople={showPeople}
            ordering={ordering}
            tint={group.groupId ? undefined : tints.get(group.person.id)}
            onTogglePerson={onTogglePerson}
            move={
              group.person.id === ORPHAN_GROUP_ID ? null : (
                <MoveButtons
                  kind="person"
                  id={group.person.id}
                  name={group.person.displayName}
                  index={(group.groupId ? userGroups : movablePeople).indexOf(
                    group,
                  )}
                  count={(group.groupId ? userGroups : movablePeople).length}
                  onMove={onMove}
                />
              )
            }
          >
            {group.calendars.map((calendar, calendarIndex) => (
              <CalendarRow
                key={calendar.id}
                calendar={calendar}
                index={calendarIndex}
                count={group.calendars.length}
                categories={categories.filter(
                  (category) => category.calendarId === calendar.id,
                )}
                hiddenCategories={hiddenCategories}
                ordering={ordering}
                onToggleCalendar={onToggleCalendar}
                onToggleCategory={onToggleCategory}
                onMove={onMove}
              />
            ))}
          </SectionItem>
        ))}
      </ul>
      {tasks && !folded ? (
        <div className="border-t border-line pt-2">
          <Switch
            checked={tasks.shown}
            onCheckedChange={tasks.setShown}
            label="Tareas con fecha"
            description="Lo pendiente de tus notas, el día que vence"
          />
        </div>
      ) : null}
      {folded || !online ? null : (
        <a
          href="/api/ics/export?visible=1"
          download
          className="inline-flex min-h-11 items-center self-start px-1 text-sm font-semibold text-ink underline decoration-control underline-offset-4 hover:decoration-ink"
        >
          Exportar los visibles
        </a>
      )}
    </section>
  );
}
