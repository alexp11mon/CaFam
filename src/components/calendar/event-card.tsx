"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  loadEventCard,
  type EventCardData,
} from "@/app/dashboard/events/card-actions";
import { CloseIcon } from "@/components/shell/icons";
import { useToast } from "@/components/ui/toast";
import { formatEventWhen } from "@/lib/calendar/format";
import type { CalendarEventItem } from "@/lib/calendar/layout";
import { boxOf, placeCard, type Box } from "@/lib/calendar/popover";
import { isTyping } from "@/lib/calendar/shortcuts";
import { UNDO_NOTICES } from "@/lib/calendar/undo";
import { PHONE_QUERY } from "@/lib/hooks/use-is-phone";
import {
  findVisibleBlock,
  morphIn,
  morphOut,
  takeMorphOrigin,
} from "@/lib/motion/morph";
import { originFrom } from "@/lib/motion/origin";
import { POP_OUT_MS } from "@/lib/motion/play";
import { readOnlyEventText } from "@/lib/sync/read-only";
import { useEventClipboard } from "./event-clipboard";

export type CardEvent = CalendarEventItem & {
  location?: string | null;
  calendarName?: string;
};

const ACTION =
  "inline-flex min-h-11 items-center justify-center rounded-full border border-control bg-paper px-4 text-base font-semibold text-ink press hover:bg-stone focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * The detail of an event beside its block, from 769 px (spec 019 RF-1 to
 * RF-14, plan D8, D9): a dialog that is not modal, so the calendar stays in
 * view and usable. It opens with what the view has and reads the rest.
 */
export function EventCard({
  event,
  anchor,
  timeZone,
  canEdit,
  onClose,
  onDelete,
}: {
  event: CardEvent;
  /** Where the block that opened it is on screen. */
  anchor: Box;
  timeZone: string;
  canEdit: boolean;
  /** `restoreFocus`: back to the event that opened it (RF-13). */
  onClose: (restoreFocus: boolean) => void;
  onDelete: () => void;
}) {
  const router = useRouter();
  const { show } = useToast();
  const clipboard = useEventClipboard();
  const card = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [place, setPlace] = useState<Box | null>(null);
  const [leaving, setLeaving] = useState(false);
  // The month segment it grew from, to shrink back into (plan R4).
  const segment = useRef<string | undefined>(undefined);
  const morphed = useRef(false);
  const closing = useRef(false);
  const alive = useRef(true);
  const [data, setData] = useState<EventCardData | null>(null);
  const editable = data ? data.canEdit : canEdit;

  // Beside the block, inside the screen (RF-2).
  useLayoutEffect(() => {
    const element = card.current;
    if (!element) return;
    const size = { width: element.offsetWidth, height: element.offsetHeight };
    const { left, top } = placeCard(anchor, size, {
      width: window.innerWidth,
      height: window.innerHeight,
    });
    setPlace({ left, top, ...size });
  }, [anchor, data]);

  // Once placed, it grows out of the block that was pressed; without one it
  // pops in as before (spec 021 RF-55, RF-59).
  useLayoutEffect(() => {
    const element = card.current;
    if (!place || !element || morphed.current) return;
    morphed.current = true;
    const origin = takeMorphOrigin(event.id);
    if (!origin) return;
    segment.current = origin.segment;
    void morphIn(element, origin.box, origin.color);
  }, [place, event.id]);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  /**
   * Closes into the block where it is now, or with the pop exit if it is no
   * longer on screen (spec 021 RF-57, RF-58); unmounts once it has left.
   */
  const close = useCallback(
    (restoreFocus: boolean) => {
      const element = card.current;
      if (closing.current || !element) return;
      closing.current = true;
      const done = () => {
        if (alive.current) onClose(restoreFocus);
      };
      const block = findVisibleBlock(event.id, segment.current);
      if (block) {
        void morphOut(element, boxOf(block), event.color).then(done);
        return;
      }
      setLeaving(true);
      setTimeout(done, POP_OUT_MS);
    },
    [event.id, event.color, onClose],
  );

  // Focus goes into the card when it opens (RF-13).
  useEffect(() => {
    card.current?.querySelector<HTMLElement>("button")?.focus();
  }, []);

  // The rest of the detail (RF-4, RF-5, plan D9).
  useEffect(() => {
    let live = true;
    loadEventCard(event.id).then(
      (result) => {
        if (!live) return;
        if ("gone" in result) onClose(false);
        else setData(result);
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
    // Only for this event: the parent remounts the card for another one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.id]);

  // A click outside closes it; a click on another event moves it (RF-11, RF-12).
  useEffect(() => {
    const onPointerDown = (pointer: PointerEvent) => {
      const target = pointer.target as Element | null;
      if (!target || card.current?.contains(target)) return;
      if (target.closest("[data-event-id]")) return;
      // Another window (the scope question, a menu) is not outside.
      if (target.closest("dialog[open], [role=menu]")) return;
      close(false);
    };
    // Below 769 px the phone's sheet is the detail (cases: narrower window).
    const media = window.matchMedia?.(PHONE_QUERY);
    const onMedia = () => {
      if (media?.matches) onClose(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    media?.addEventListener("change", onMedia);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      media?.removeEventListener("change", onMedia);
    };
  }, [onClose, close]);

  const editHref = `/dashboard/events/${event.id}?edit=1`;

  // Escape, and E, Supr and Ctrl/⌘+C of the detail (RF-11, RF-14).
  function onKeyDown(key: React.KeyboardEvent) {
    if (key.key === "Escape") {
      key.preventDefault();
      close(true);
      return;
    }
    if (isTyping(key.target) || key.altKey) return;
    const command = key.ctrlKey || key.metaKey;
    if (command && key.key.toLowerCase() === "c") {
      if (window.getSelection()?.toString()) return;
      key.preventDefault();
      clipboard?.copy(event.id);
      show(UNDO_NOTICES.copied);
    } else if (command || !editable) {
      return;
    } else if (key.key.toLowerCase() === "e") {
      key.preventDefault();
      onClose(false);
      router.push(editHref);
    } else if (key.key === "Delete" || key.key === "Backspace") {
      key.preventDefault();
      onDelete();
    }
  }

  const counts = [
    event.imageCount ? plural(event.imageCount, "imagen", "imágenes") : null,
    event.commentCount
      ? plural(event.commentCount, "comentario", "comentarios")
      : null,
  ].filter(Boolean);

  return (
    <dialog
      ref={card}
      open
      aria-labelledby={titleId}
      tabIndex={-1}
      data-event-card=""
      data-leaving={leaving ? "" : undefined}
      onKeyDown={onKeyDown}
      style={
        {
          left: place?.left ?? 0,
          top: place?.top ?? 0,
          visibility: place ? undefined : "hidden",
          // The pop exit heads for the event (spec 021 RF-58).
          "--pop-origin": place ? originFrom(anchor, place) : undefined,
        } as React.CSSProperties
      }
      className="pop fixed z-40 m-0 flex max-h-[calc(100dvh-2rem)] w-90 flex-col gap-3 overflow-y-auto rounded-3xl glass-float p-4 text-ink shadow-float outline-none"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="mt-2 size-4 shrink-0 rounded-full ring-1 ring-pastel-ink/20"
          style={{ backgroundColor: event.color }}
        />
        <h2
          id={titleId}
          className="min-w-0 flex-1 break-words text-lg font-bold"
        >
          {event.title}
        </h2>
        <button
          type="button"
          aria-label="Cerrar"
          onClick={() => close(true)}
          className="-mt-1 -mr-1 inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted press hover:bg-stone hover:text-ink focus-visible:outline-2 focus-visible:outline-ink"
        >
          <CloseIcon />
        </button>
      </div>
      <dl className="flex flex-col gap-1.5 text-sm">
        <dt className="sr-only">Cuándo</dt>
        <dd data-testid="card-when">
          {event.allDay ? "Todo el día · " : ""}
          {formatEventWhen(event, timeZone)}
        </dd>
        {data?.repeat ? (
          <>
            <dt className="sr-only">Se repite</dt>
            <dd className="text-muted">{data.repeat.summary}</dd>
          </>
        ) : null}
        {event.location ? (
          <>
            <dt className="sr-only">Lugar</dt>
            <dd className="break-words">{event.location}</dd>
          </>
        ) : null}
        {event.calendarName ? (
          <>
            <dt className="sr-only">Calendario</dt>
            <dd className="text-muted">{event.calendarName}</dd>
          </>
        ) : null}
        {data ? (
          <>
            <dt className="sr-only">Creado por</dt>
            <dd className="text-muted">Creado por {data.author}</dd>
          </>
        ) : (
          <dd aria-hidden="true" className="h-4 w-40 rounded-full bg-line" />
        )}
        {data?.description ? (
          <>
            <dt className="sr-only">Descripción</dt>
            <dd
              data-testid="card-description"
              className="line-clamp-3 whitespace-pre-line break-words"
            >
              {data.description}
            </dd>
          </>
        ) : null}
        {counts.length ? (
          <>
            <dt className="sr-only">Imágenes y comentarios</dt>
            <dd className="text-muted">{counts.join(" · ")}</dd>
          </>
        ) : null}
      </dl>
      {data?.readOnly ? (
        <p className="text-sm text-muted">
          {readOnlyEventText(data.readOnly, data.provider ?? "google")}
        </p>
      ) : null}
      {/* The actions land just after the card (spec 021 RF-19). */}
      <div className="settle flex flex-wrap gap-2">
        {editable ? (
          <>
            <Link
              href={editHref}
              onClick={() => onClose(false)}
              className={ACTION}
            >
              Editar
            </Link>
            <Link
              href={`/dashboard/events/new?from=${event.id}`}
              onClick={() => onClose(false)}
              className={ACTION}
            >
              Duplicar
            </Link>
            <button type="button" onClick={onDelete} className={ACTION}>
              Borrar
            </button>
          </>
        ) : null}
        {/* The whole detail, with images and comments, for every member (RF-8). */}
        <Link
          href={`/dashboard/events/${event.id}`}
          onClick={() => onClose(false)}
          className={ACTION}
        >
          Abrir
        </Link>
      </div>
    </dialog>
  );
}
