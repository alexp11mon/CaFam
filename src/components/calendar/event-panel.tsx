"use client";

import { useRouter } from "next/navigation";
import {
  startTransition,
  useEffect,
  useRef,
  useState,
  ViewTransition,
} from "react";
import { EventComments } from "@/components/comments/event-comments";
import { EventNotes } from "@/components/notes/event-notes";
import { loadEventNotes } from "@/app/dashboard/notes/actions";
import { EventImages } from "@/components/images/event-images";
import { ImageUploader } from "@/components/images/image-uploader";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import type { EventImage } from "@/lib/images/queries";
import type {
  ConfirmState,
  FormAction,
  FormState,
} from "@/lib/forms/form-state";
import { EventDetail, type EventDetailData } from "./event-detail";
import { EventReminders } from "./reminder-field";
import { setEventReminders } from "@/app/dashboard/events/reminder-actions";
import {
  EventForm,
  type CalendarOption,
  type CategoryOption,
  type EventFormValues,
} from "./event-form";
import { isTyping } from "@/lib/calendar/shortcuts";
import { UNDO_NOTICES } from "@/lib/calendar/undo";
import { useToast } from "@/components/ui/toast";
import { useEventClipboard } from "./event-clipboard";
import { DONE_MESSAGES, useEventModal } from "./event-modal";
import { useUndoToast } from "./use-undo-toast";
import { deleteFromDetailOrQueue } from "@/lib/offline/event-actions";
import { useOfflineQueue } from "@/lib/hooks/use-offline";
import { entityOf } from "@/lib/offline/outbox";
import { useHoldLive } from "@/lib/hooks/use-hold-live";
import { useConnection } from "@/lib/hooks/use-connection";
import { OfflineComments } from "@/components/offline/offline-comments";

/**
 * An event's detail, which turns into its edit form in the same place
 * (spec 008 RF-2, RF-3, RF-35, RF-36). Used by the window and the full page.
 */
export function EventPanel({
  detail,
  timeZone,
  canEdit: canEditOnline,
  editInitial,
  calendars,
  categories,
  updateAction,
  deleteAction,
  canAttach = false,
  images = [],
  series,
  startEditing = false,
  reminders,
}: {
  /** The user's own reminders; none offline, where they need the network (spec 040 RF-7). */
  reminders?: number[];
  /** "Editar" of the detail card opens straight in the form (spec 019 RF-9). */
  startEditing?: boolean;
  detail: EventDetailData;
  timeZone: string;
  /** Owner or editor; readers get no buttons (RF-26, spec 008 RF-36). */
  canEdit: boolean;
  editInitial: EventFormValues;
  calendars: CalendarOption[];
  categories: CategoryOption[];
  updateAction: FormAction<FormState<keyof EventFormValues>>;
  deleteAction: FormAction<ConfirmState>;
  /** Any member adds images, viewers included (spec 012 RF-1, RF-4). */
  canAttach?: boolean;
  /** Ready images in upload order (spec 012 RF-9). */
  images?: EventImage[];
  /** An occurrence of a series (spec 013 RF-15). */
  series?: { limitReached: boolean } | null;
}) {
  const modal = useEventModal();
  // Offline as online: comments and images wait in the queue, Google and
  // iCloud included (spec 035 RF-1, RF-18, RF-30).
  const online = useConnection();
  const canEdit = canEditOnline;
  const [editing, setEditingNow] = useState(startEditing);
  // The detail and the form cross-fade instead of swapping (spec 021 RF-52, D14).
  const setEditing = (next: boolean) =>
    startTransition(() => setEditingNow(next));
  useHoldLive(editing);
  const router = useRouter();
  const showUndo = useUndoToast();
  const { show } = useToast();
  const clipboard = useEventClipboard();
  const root = useRef<HTMLDivElement>(null);
  const { queue } = useOfflineQueue();
  const waiting = queue.some(
    (entry) => entityOf(entry.change) === `event:${detail.id}`,
  );
  // Offline the delete waits on the device (spec 034 RF-22).
  const [deleteFromDetail] = useState(() =>
    deleteFromDetailOrQueue(detail.id, deleteAction),
  );

  // E, Supr and Ctrl/⌘+C with the detail open (spec 017 RF-54, RF-55,
  // RF-57); never while typing or with another window over it (RF-63).
  useEffect(() => {
    if (editing) return;
    const onKeyDown = (key: KeyboardEvent) => {
      const panel = root.current;
      if (!panel || key.defaultPrevented || isTyping(key.target)) return;
      const over = [...document.querySelectorAll("dialog[open]")].some(
        (dialog) => !dialog.contains(panel),
      );
      if (over || key.altKey) return;
      const command = key.ctrlKey || key.metaKey;
      if (command && key.key.toLowerCase() === "c") {
        if (window.getSelection()?.toString()) return;
        key.preventDefault();
        clipboard?.copy(detail.id);
        show(UNDO_NOTICES.copied);
      } else if (command || !canEdit) {
        return;
      } else if (key.key.toLowerCase() === "e") {
        key.preventDefault();
        setEditing(true);
        modal?.expand();
      } else if (key.key === "Delete" || key.key === "Backspace") {
        key.preventDefault();
        panel.querySelector<HTMLButtonElement>("[data-delete-event]")?.click();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [editing, canEdit, clipboard, detail.id, modal, show]);

  if (editing) {
    return (
      <ViewTransition key="edit">
        <div className="flex flex-col gap-4">
          <Button
            variant="secondary"
            onClick={() => setEditing(false)}
            className="self-start"
          >
            Volver al detalle
          </Button>
          <EventForm
            action={updateAction}
            eventId={detail.id}
            initial={editInitial}
            calendars={calendars}
            categories={categories}
            submitLabel="Guardar cambios"
            pendingLabel="Guardando…"
            cancelHref="/dashboard/calendar"
            series={series ?? undefined}
            reminders={reminders ? { initial: reminders } : undefined}
            timeZone={timeZone}
          />
        </div>
      </ViewTransition>
    );
  }

  return (
    <ViewTransition key="detail">
      <div ref={root} className="contents">
        <EventDetail
          event={{
            ...detail,
            ...(waiting ? { pending: true } : {}),
          }}
          timeZone={timeZone}
          canEdit={canEdit}
          deleteAction={deleteFromDetail}
          onDeleted={
            modal?.finish ??
            // A full page goes back to the calendar with the notice (spec 017 RF-25).
            ((done, undo) => {
              showUndo(DONE_MESSAGES[done], undo);
              router.replace("/dashboard/calendar");
            })
          }
          comments={
            online ? (
              <>
                {/* Spec 048 RF-9, RF-10. */}
                <EventNotes eventId={detail.id} loadNotes={loadEventNotes} />
                <EventComments eventId={detail.id} timeZone={timeZone} />
              </>
            ) : (
              <OfflineComments
                eventId={detail.id}
                calendarId={editInitial.calendarId}
                timeZone={timeZone}
              />
            )
          }
          media={
            <>
              {reminders && online ? (
                <EventReminders
                  eventId={detail.id}
                  allDay={detail.allDay}
                  initial={reminders}
                  save={setEventReminders}
                />
              ) : null}
              <EventImages
                images={images}
                title={detail.title}
                timeZone={timeZone}
                eventId={detail.id}
              />
              {canAttach ? (
                <ImageUploader eventId={detail.id} saved={images.length} />
              ) : null}
            </>
          }
          actions={
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  // Editing on a phone fills the screen (spec 017 RF-47).
                  setEditing(true);
                  modal?.expand();
                }}
              >
                Editar
              </Button>
              <LinkButton
                href={`/dashboard/events/new?from=${detail.id}`}
                // Replace: saving the copy goes back to the calendar, not to this event.
                replace
                variant="secondary"
              >
                Duplicar
              </LinkButton>
            </>
          }
        />
      </div>
    </ViewTransition>
  );
}
