import Link from "next/link";
import { PinIcon } from "@/components/shell/icons";
import { sortItems } from "@/lib/notes/order";
import { dueLabel, progress } from "@/lib/notes/progress";
import type { Note } from "@/lib/notes/types";
import { PendingMark } from "@/components/offline/pending-mark";

/** How many pending items a card shows before "y N más". */
const SHOWN_ITEMS = 3;

/**
 * A note in the list (spec 028 RF-1): its color, title, where it is shared,
 * when it is due, and a look inside: the first pending items of a list with
 * "X de Y", or the start of a text.
 */
export function NoteCard({
  note,
  today,
}: {
  note: Note & { pending?: boolean };
  today: string;
}) {
  const due = dueLabel(note.dueDate, today);
  const done = progress(note.items);
  const pending = sortItems(note.items).filter((item) => !item.done);
  const title =
    note.title ||
    (note.kind === "list" ? "Lista sin título" : "Nota sin título");

  return (
    <Link
      href={`/dashboard/notes/${note.id}`}
      className="relative flex h-full flex-col gap-2 overflow-hidden rounded-card surface p-4 pl-5 press-quiet hover:bg-stone focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
    >
      {/* The note's color is only a mark, as a calendar's (amendment 10). */}
      <span
        aria-hidden="true"
        style={note.color ? { backgroundColor: note.color } : undefined}
        className={`absolute inset-y-0 left-0 w-1.5 ${note.color ? "" : "bg-line"}`}
      />
      <span className="flex items-start gap-2">
        <span className="min-w-0 flex-1 text-lg leading-snug font-semibold text-ink">
          {title}
        </span>
        <PendingMark pending={note.pending} />
        {note.pinned ? (
          <span className="text-accent-ink">
            <PinIcon filled />
            <span className="sr-only">Fijada</span>
          </span>
        ) : null}
      </span>
      {note.kind === "list" ? (
        <>
          {pending.length > 0 ? (
            <ul className="flex flex-col gap-1 text-ink">
              {pending.slice(0, SHOWN_ITEMS).map((item) => (
                <li key={item.id} className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="size-4 shrink-0 rounded-block border border-control"
                  />
                  <span className="truncate">{item.text}</span>
                </li>
              ))}
              {pending.length > SHOWN_ITEMS ? (
                <li className="text-sm text-muted">
                  y {pending.length - SHOWN_ITEMS} más
                </li>
              ) : null}
            </ul>
          ) : null}
          <span className="text-sm font-semibold text-muted tabular-nums">
            {done.complete ? "Todo hecho · " : ""}
            {done.label}
          </span>
        </>
      ) : note.body ? (
        <span className="line-clamp-4 whitespace-pre-line text-muted">
          {note.body}
        </span>
      ) : (
        <span className="text-sm text-muted">Nota vacía</span>
      )}
      <span className="mt-auto flex flex-wrap gap-x-3 gap-y-1 pt-1 text-sm">
        {due ? (
          <span
            className={due.late ? "font-semibold text-danger" : "text-muted"}
          >
            {due.text}
          </span>
        ) : null}
        {note.calendarName ? (
          <span className="text-muted">Compartida en {note.calendarName}</span>
        ) : null}
      </span>
    </Link>
  );
}
