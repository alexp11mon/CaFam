"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import type { NoteResult } from "@/app/dashboard/notes/actions";
import {
  addItemOrQueue,
  clearDoneOrQueue,
  deleteItemOrQueue,
  deleteNoteOrQueue,
  moveItemsOrQueue,
  updateItemOrQueue,
  updateNoteOrQueue,
} from "@/lib/offline/note-actions";
import {
  ArchiveIcon,
  ChevronIcon,
  PinIcon,
  TrashIcon,
} from "@/components/shell/icons";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Select } from "@/components/ui/select";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { CALENDAR_COLORS } from "@/lib/calendar/palette";
import { useHoldLive } from "@/lib/hooks/use-hold-live";
import { useLiveCalendar } from "@/lib/hooks/use-live-calendar";
import { NOTE_MESSAGES } from "@/lib/notes/error-messages";
import { NOTE_TITLE_MAX } from "@/lib/notes/limits";
import {
  applyPositions,
  moveItem,
  nextPosition,
  placeItem,
  sortItems,
} from "@/lib/notes/order";
import { dueLabel as itemDueLabel } from "@/lib/notes/due";
import type { NoteAccess } from "@/lib/notes/permissions";
import { dueLabel } from "@/lib/notes/progress";
import type { Note, NoteItem } from "@/lib/notes/types";
import { Checklist } from "./checklist";
import { PendingMark } from "@/components/offline/pending-mark";
import { useOfflineQueue } from "@/lib/hooks/use-offline";
import { noteOf } from "@/lib/offline/outbox";
import { useConnection } from "@/lib/hooks/use-connection";
import { networkReason } from "@/lib/offline/gates";
import { TextNote } from "./text-note";

type Fields = Partial<
  Pick<
    Note,
    | "title"
    | "body"
    | "color"
    | "pinned"
    | "archived"
    | "dueDate"
    | "calendarId"
  >
>;

/**
 * One note (spec 028 RF-5 to RF-10, RF-12, plan D5). The note on screen lives
 * here: every change shows at once and is saved behind; if saving fails, that
 * change is undone and said. What the server sends later (someone else's
 * change) replaces it while nothing is being saved or typed.
 */
export function NoteEditor({
  note: fromServer,
  access,
  calendars,
  today,
  userId,
  timeZone = "UTC",
}: {
  /** The profile's zone, for the event's date (spec 048 RF-10). */
  timeZone?: string;
  note: Note;
  access: NoteAccess;
  /** Calendars where the user can write, to share the note there. */
  calendars: readonly { id: string; name: string }[];
  today: string;
  userId: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [note, setNote] = useState(fromServer);
  const [seen, setSeen] = useState(fromServer);
  const [saving, setSaving] = useState(0);
  const [typing, setTyping] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState("");
  const titleId = useId();
  const dueId = useId();

  // Fresh data from the server is the new starting point (RF-12).
  if (seen !== fromServer && saving === 0 && !typing) {
    setSeen(fromServer);
    setNote(fromServer);
  }
  useLiveCalendar(userId);
  // Nothing moves under the fingers while a field is being typed in.
  useHoldLive(typing || saving > 0);

  /** Shows `next` at once, saves, and goes back if it could not (RF-9). */
  async function change(
    next: (current: Note) => Note,
    save: () => Promise<NoteResult>,
    said?: string,
  ): Promise<boolean> {
    const before = note;
    setNote(next);
    setSaving((count) => count + 1);
    let result: NoteResult;
    try {
      result = await save();
    } catch {
      result = { error: NOTE_MESSAGES.connection };
    }
    setSaving((count) => count - 1);
    if (result.error) {
      setNote(before);
      toast.show(result.error);
      return false;
    }
    if (said) setNotice(said);
    return true;
  }

  const setFields = (fields: Fields, said?: string) =>
    change(
      (current) => ({ ...current, ...fields }),
      () => updateNoteOrQueue(note, fields),
      said,
    );

  const withItems =
    (map: (items: NoteItem[]) => NoteItem[]) => (current: Note) => ({
      ...current,
      items: map(current.items),
    });

  function add(text: string) {
    const item: NoteItem = {
      // Its definitive id, so it can be ticked before it is saved (plan D4).
      id: crypto.randomUUID(),
      text,
      done: false,
      doneAt: null,
      position: nextPosition(note.items),
    };
    void change(
      withItems((items) => [...items, item]),
      () =>
        addItemOrQueue(note, { id: item.id, text, position: item.position }),
      `Añadido «${text}»`,
    );
  }

  function toggle(item: NoteItem) {
    const done = !item.done;
    void change(
      withItems((items) =>
        items.map((other) =>
          other.id === item.id
            ? { ...other, done, doneAt: done ? new Date().toISOString() : null }
            : other,
        ),
      ),
      () => updateItemOrQueue(note.id, item, { done }),
      done ? `Hecho: «${item.text}»` : `Pendiente otra vez: «${item.text}»`,
    );
  }

  function setDue(
    item: NoteItem,
    next: { dueDate: string | null; dueTime: string | null },
  ) {
    void change(
      withItems((items) =>
        items.map((other) =>
          other.id === item.id ? { ...other, ...next } : other,
        ),
      ),
      () => updateItemOrQueue(note.id, item, next),
      next.dueDate
        ? `Fecha de «${item.text}»: ${itemDueLabel(next.dueDate, next.dueTime, today)}`
        : `Sin fecha: «${item.text}»`,
    );
  }

  function rename(item: NoteItem, text: string) {
    void change(
      withItems((items) =>
        items.map((other) =>
          other.id === item.id ? { ...other, text } : other,
        ),
      ),
      () => updateItemOrQueue(note.id, item, { text }),
    );
  }

  // Saves new positions and says where the item ended (spec 048 RF-4).
  function reorder(
    item: NoteItem,
    positions: { id: string; position: number }[] | null,
  ) {
    if (!positions) return;
    const moved = sortItems(applyPositions(note.items, positions)).filter(
      (other) => !other.done,
    );
    const place = moved.findIndex((other) => other.id === item.id) + 1;
    void change(
      withItems((items) => applyPositions(items, positions)),
      () => moveItemsOrQueue(note.id, positions),
      `Movido a la posición ${place} de ${moved.length}`,
    );
  }

  const move = (item: NoteItem, direction: "up" | "down") =>
    reorder(item, moveItem(note.items, item.id, direction));
  const place = (item: NoteItem, toIndex: number) =>
    reorder(item, placeItem(note.items, item.id, toIndex));

  async function remove(item: NoteItem) {
    const removed = await change(
      withItems((items) => items.filter((other) => other.id !== item.id)),
      () => deleteItemOrQueue(note.id, item),
    );
    if (!removed) return;
    // "Deshacer" puts it back as it was (RF-6, plan D8).
    toast.show("Elemento borrado", {
      undo: async () => {
        const back = await change(
          withItems((items) => [...items, item]),
          () =>
            addItemOrQueue(note, {
              id: item.id,
              text: item.text,
              position: item.position,
              done: item.done,
            }),
        );
        return back ? null : NOTE_MESSAGES.connection;
      },
    });
  }

  function clear() {
    void change(
      withItems((items) => items.filter((item) => !item.done)),
      () => clearDoneOrQueue(note),
      "Completados borrados",
    );
  }

  async function removeNote() {
    setSaving((count) => count + 1);
    let result: NoteResult;
    try {
      result = await deleteNoteOrQueue(note);
    } catch {
      result = { error: NOTE_MESSAGES.connection };
    }
    setSaving((count) => count - 1);
    setConfirming(false);
    if (result.error) {
      toast.show(result.error);
      return;
    }
    toast.show("Nota borrada");
    router.replace("/dashboard/notes");
  }

  // Changes of this note still on the device (spec 034 RF-37).
  const { queue } = useOfflineQueue();
  // Personal to shared and back waits for the network (spec 034 RF-35).
  const moveReason = networkReason(useConnection());
  const moveId = useId();
  const waiting = queue.some((entry) => noteOf(entry.change) === note.id);
  const due = dueLabel(note.dueDate, today);
  const { canWrite } = access;

  return (
    <div
      className="flex flex-col gap-4"
      onFocusCapture={(event) => {
        if ((event.target as Element).matches("input, textarea"))
          setTyping(true);
      }}
      onBlurCapture={() => setTyping(false)}
    >
      <div className="flex items-center gap-1">
        <Link
          href="/dashboard/notes"
          className="inline-flex min-h-11 items-center gap-1 rounded-control pr-2 text-sm font-semibold text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          <ChevronIcon direction="left" />
          Notas
        </Link>
        <span className="flex-1" />
        <PendingMark pending={waiting} label />
        {canWrite ? (
          <>
            <IconButton
              label={note.pinned ? "Dejar de fijar" : "Fijar arriba"}
              aria-pressed={note.pinned}
              onClick={() =>
                void setFields(
                  { pinned: !note.pinned },
                  note.pinned ? "Nota sin fijar" : "Nota fijada",
                )
              }
              className={note.pinned ? "text-accent-ink" : ""}
            >
              <PinIcon filled={note.pinned} />
            </IconButton>
            <IconButton
              label={note.archived ? "Sacar del archivo" : "Archivar"}
              aria-pressed={note.archived}
              onClick={() =>
                void setFields(
                  { archived: !note.archived },
                  note.archived ? "Nota recuperada" : "Nota archivada",
                )
              }
              className={note.archived ? "text-accent-ink" : ""}
            >
              <ArchiveIcon />
            </IconButton>
          </>
        ) : null}
        {access.canDelete ? (
          <IconButton
            label="Borrar la nota"
            onClick={() => setConfirming(true)}
          >
            <TrashIcon />
          </IconButton>
        ) : null}
      </div>

      <div
        style={note.color ? { borderColor: note.color } : undefined}
        className={`flex flex-col gap-4 rounded-card surface p-4 ${note.color ? "border-t-8" : ""}`}
      >
        {canWrite ? (
          <>
            <label htmlFor={titleId} className="sr-only">
              Título
            </label>
            <input
              id={titleId}
              defaultValue={note.title}
              key={note.title}
              maxLength={NOTE_TITLE_MAX}
              placeholder="Título"
              onBlur={(event) => {
                const title = event.target.value.trim();
                if (title !== note.title) void setFields({ title });
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
              className="min-h-12 w-full rounded-block bg-transparent text-2xl font-semibold text-ink outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-ink/20"
            />
          </>
        ) : (
          <h1 className="text-2xl font-semibold text-ink">
            {note.title || "Sin título"}
          </h1>
        )}

        {access.readOnlyReason ? (
          <p className="rounded-control bg-stone px-3 py-2 text-sm text-muted">
            {access.readOnlyReason}
          </p>
        ) : null}
        {due ? (
          <p
            className={`text-sm font-semibold ${due.late ? "text-danger" : "text-muted"}`}
          >
            {due.text}
          </p>
        ) : null}
        {note.calendarName && !access.canMove ? (
          <p className="text-sm text-muted">
            Compartida en {note.calendarName}
          </p>
        ) : null}
        {note.event ? (
          // The event it was made for (spec 048 RF-10).
          <p className="text-sm text-muted">
            De:{" "}
            <Link
              href={`/dashboard/events/${note.event.id}`}
              prefetch={false}
              className="font-semibold text-ink underline decoration-control underline-offset-4 hover:decoration-ink"
            >
              {note.event.title} ·{" "}
              {new Intl.DateTimeFormat("es-ES", {
                day: "numeric",
                month: "short",
                timeZone: note.event.allDay ? "UTC" : timeZone,
              }).format(new Date(note.event.startsAt))}
            </Link>
          </p>
        ) : null}

        {note.kind === "list" ? (
          <Checklist
            items={note.items}
            canWrite={canWrite}
            onAdd={add}
            onToggle={toggle}
            onRename={rename}
            onMove={move}
            onPlace={place}
            onDelete={(item) => void remove(item)}
            onClearDone={clear}
            today={today}
            onDue={setDue}
          />
        ) : (
          <TextNote
            body={note.body}
            canWrite={canWrite}
            onSave={(body) => setFields({ body })}
          />
        )}
      </div>

      {canWrite ? (
        <section
          aria-label="Opciones de la nota"
          className="flex flex-col gap-4 rounded-card surface p-4"
        >
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-ink">Color</legend>
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                aria-pressed={note.color === null}
                onClick={() => void setFields({ color: null })}
                className="flex min-h-11 items-center rounded-full border border-control px-3 text-sm font-semibold text-ink press-quiet focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink aria-pressed:border-ink aria-pressed:ring-2 aria-pressed:ring-ink/20"
              >
                Sin color
              </button>
              {CALENDAR_COLORS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  aria-label={color.label}
                  aria-pressed={note.color === color.value}
                  onClick={() => void setFields({ color: color.value })}
                  className="group flex size-11 items-center justify-center rounded-full press-quiet focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                >
                  <span
                    aria-hidden="true"
                    style={{ backgroundColor: color.value }}
                    className="size-7 rounded-full ring-1 ring-pastel-ink/20 group-aria-pressed:ring-2 group-aria-pressed:ring-ink group-aria-pressed:ring-offset-2 group-aria-pressed:ring-offset-paper"
                  />
                </button>
              ))}
            </div>
          </fieldset>
          <div className="flex flex-col gap-1">
            <label htmlFor={dueId} className="text-sm font-medium text-ink">
              Fecha límite
            </label>
            <div className="flex items-center gap-2">
              <input
                id={dueId}
                type="date"
                value={note.dueDate ?? ""}
                onChange={(event) =>
                  void setFields({ dueDate: event.target.value || null })
                }
                className="min-h-12 min-w-0 flex-1 rounded-control border border-control bg-paper px-4 text-base text-ink outline-none focus-visible:border-ink focus-visible:ring-2 focus-visible:ring-ink/20"
              />
              {note.dueDate ? (
                <Button
                  variant="quiet"
                  onClick={() => void setFields({ dueDate: null })}
                >
                  Quitar
                </Button>
              ) : null}
            </div>
          </div>
          {access.canMove ? (
            <Select
              label="Dónde se guarda"
              name="calendarId"
              value={note.calendarId ?? ""}
              disabled={Boolean(moveReason)}
              aria-describedby={moveReason ? `${moveId}` : undefined}
              onChange={(event) => {
                const calendarId = event.target.value || null;
                const name =
                  calendars.find((calendar) => calendar.id === calendarId)
                    ?.name ?? null;
                void change(
                  (current) => ({ ...current, calendarId, calendarName: name }),
                  () => updateNoteOrQueue(note, { calendarId }),
                  calendarId ? `Compartida en ${name}` : "Nota personal",
                );
              }}
            >
              <option value="">Personal (solo tú la ves)</option>
              {calendars.map((calendar) => (
                <option key={calendar.id} value={calendar.id}>
                  Compartida en {calendar.name}
                </option>
              ))}
            </Select>
          ) : null}
          {access.canMove && moveReason ? (
            <p id={moveId} className="text-sm text-muted">
              {moveReason}
            </p>
          ) : null}
        </section>
      ) : null}

      {/* What changed, for who cannot see it. */}
      <p role="status" aria-live="polite" className="sr-only">
        {notice}
      </p>

      <Sheet
        open={confirming}
        onClose={() => setConfirming(false)}
        title="¿Borrar esta nota?"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={() => void removeNote()}>
              Borrar la nota
            </Button>
          </div>
        }
      >
        <p className="text-muted">
          {note.calendarName
            ? `Se borrará para todos los miembros de «${note.calendarName}». No se puede deshacer.`
            : "Se borrará con todo su contenido. No se puede deshacer."}
        </p>
      </Sheet>
    </div>
  );
}
