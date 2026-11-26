"use client";

import Link from "next/link";
import { createContext, use, type CSSProperties } from "react";
import { useT } from "@/components/i18n/locale-provider";

/** A pending note or item with a due date (spec 048 RF-6). */
export interface CalendarTask {
  noteId: string;
  /** Null for a note with its own date, which has nothing to tick. */
  itemId: string | null;
  text: string;
  noteTitle: string;
  calendarId: string | null;
  dueDate: string;
  dueTime: string | null;
}

export interface CalendarTasks {
  shown: boolean;
  setShown: (show: boolean) => void;
  byDay: ReadonlyMap<string, CalendarTask[]>;
  /** Ticks an item (RF-7). */
  complete: (task: CalendarTask) => void;
}

/** "Tareas con fecha" of the calendar; null outside it (tests, other screens). */
export const TasksContext = createContext<CalendarTasks | null>(null);

export const useCalendarTasks = () => use(TasksContext);

/** Tasks by day, in the order the server gives (date, time, text). */
export function tasksByDay(tasks: readonly CalendarTask[]) {
  const byDay = new Map<string, CalendarTask[]>();
  for (const task of tasks) {
    byDay.set(task.dueDate, [...(byDay.get(task.dueDate) ?? []), task]);
  }
  return byDay;
}

/** "Pan · Compra" or the note's title alone (RF-6). */
export function taskLabel(task: CalendarTask) {
  const time = task.dueTime ? `${task.dueTime.slice(0, 5)} ` : "";
  const of =
    task.itemId && task.noteTitle && task.noteTitle !== task.text
      ? ` · ${task.noteTitle}`
      : "";
  return `${time}${task.text}${of}`;
}

/**
 * A discreet block with a box: ticking it completes the item, the text opens
 * the note (RF-6, RF-7).
 */
export function TaskBlock({
  task,
  onComplete,
}: {
  task: CalendarTask;
  onComplete?: (task: CalendarTask) => void;
}) {
  const t = useT();
  const label = taskLabel(task);
  return (
    <div className="flex min-w-0 items-center gap-1 rounded-block border border-dashed border-control bg-paper text-xs text-ink">
      {task.itemId && onComplete ? (
        <button
          type="button"
          role="checkbox"
          aria-checked={false}
          aria-label={t("Completar «{text}»", { text: task.text })}
          onClick={() => onComplete(task)}
          className="flex size-6 shrink-0 items-center justify-center rounded-block press-quiet focus-visible:outline-2 focus-visible:outline-ink"
        >
          <span
            aria-hidden="true"
            className="size-3 rounded-full border-[1.5px] border-control"
          />
        </button>
      ) : null}
      <Link
        href={`/dashboard/notes/${task.noteId}`}
        prefetch={false}
        title={label}
        className={`min-w-0 flex-1 truncate py-0.5 pr-1 hover:underline focus-visible:outline-2 focus-visible:outline-ink ${task.itemId ? "" : "pl-1"}`}
      >
        <span className="sr-only">{t("Tarea:")}</span> {label}
      </Link>
    </div>
  );
}

/** The tasks of a day where a view puts them; nothing when hidden. */
export function DayTasks({
  day,
  limit,
  className = "",
  style,
}: {
  day: string;
  /** At most this many, then "+N" (the month's cells). */
  limit?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const t = useT();
  const tasks = useCalendarTasks();
  const list = tasks?.shown ? tasks.byDay.get(day) : undefined;
  if (!tasks || !list?.length) return null;
  const shown = limit ? list.slice(0, limit) : list;
  const more = list.length - shown.length;
  return (
    <ul
      aria-label={t("Tareas con fecha")}
      data-testid="day-tasks"
      className={`flex min-w-0 flex-col gap-0.5 ${className}`}
      style={style}
    >
      {shown.map((task) => (
        <li key={task.itemId ?? task.noteId} className="min-w-0">
          <TaskBlock task={task} onComplete={tasks.complete} />
        </li>
      ))}
      {more > 0 ? (
        <li className="px-1 text-xs font-semibold text-muted">+{more}</li>
      ) : null}
    </ul>
  );
}
