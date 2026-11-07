"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";
import {
  deleteForUndo,
  pasteEvent,
  quickChange,
} from "@/app/dashboard/events/quick-actions";
import type {
  QuickResult,
  ScopeOptions,
} from "@/app/dashboard/events/quick-writes";
import {
  SeriesScopeChoice,
  type ScopeAnswer,
  type ScopeRequest,
} from "@/components/recurrence/series-scope-choice";
import { useToast } from "@/components/ui/toast";
import { describeTimes, nudge, type Times } from "@/lib/calendar/drag";
import type { CalendarEventItem } from "@/lib/calendar/layout";
import { DEFAULT_CALENDAR_COLOR } from "@/lib/calendar/palette";
import { UNDO_NOTICES, type Change } from "@/lib/calendar/undo";
import { useEventDrag, type DragMode } from "@/lib/hooks/use-event-drag";
import { useEventKeys } from "@/lib/hooks/use-event-keys";
import { useHoldLive } from "@/lib/hooks/use-hold-live";
import { useEventClipboard } from "./event-clipboard";
import { EventCard } from "./event-card";
import { boxOf, type Box } from "@/lib/calendar/popover";
import { takeRemoteRefresh } from "@/lib/calendar/live-hold";
import { EventMenu, type MenuChoice } from "./event-menu";
import { usePresence } from "@/lib/hooks/use-presence";
import { POP_OUT_MS } from "@/lib/motion/play";
import { useUndoToast } from "./use-undo-toast";
import { captureReturn, markPulse } from "@/lib/motion/marks";

export type ChangeNotice = "moved" | "resized" | "color";

export interface EventInteractionsApi {
  timeZone: string;
  /** Owner or editor of its calendar, and Google lets it write (RF-1, RF-2). */
  canEdit: (event: CalendarEventItem) => boolean;
  /** A drag is on: no swiping and no quick window (RF-21). */
  dragging: boolean;
  setDragging: (value: boolean) => void;
  /** The event being dragged, drawn lifted (RF-8). */
  draggingId: string | null;
  /** Left lifted by a finger: shows its end handle until a tap elsewhere (RF-11). */
  liftedId: string | null;
  /** Presses an event: a drag starts once it moves (RF-5, RF-10). */
  startDrag: (
    event: CalendarEventItem,
    pointer: PointerEvent,
    options: { mode: DragMode; resize?: boolean; lifted?: boolean },
  ) => void;
  /** Opens the context menu at a point; focus goes back to `returnTo` (RF-32, RF-33). */
  openMenu: (
    event: CalendarEventItem,
    at: { left: number; top: number },
    returnTo: HTMLElement,
  ) => void;
  /** The menu is already open for this event (a key may also send `contextmenu`). */
  isMenuOpen: (event: CalendarEventItem) => boolean;
  change: (
    event: CalendarEventItem,
    change: Change,
    notice: ChangeNotice,
  ) => Promise<void>;
  remove: (event: CalendarEventItem) => Promise<void>;
  /** The detail card beside the event, from 769 px (spec 019 RF-1, RF-12). */
  openCard: (event: CalendarEventItem, anchor: HTMLElement) => void;
}

const EventInteractionsContext = createContext<EventInteractionsApi | null>(
  null,
);

/** The interactions of the calendar's events, or null outside the calendar. */
export function useEventInteractions() {
  return useContext(EventInteractionsContext);
}

export const EventInteractionsProvider = EventInteractionsContext;

type Override = { change: Change | "deleted"; pending: boolean };

function applyOverride<T extends CalendarEventItem>(
  event: T,
  change: Change,
  calendarColor: string | undefined,
): T {
  if (change.kind === "times") {
    const { startsAt, endsAt, allDay } = change;
    return { ...event, startsAt, endsAt, allDay };
  }
  return {
    ...event,
    color: change.color ?? calendarColor ?? DEFAULT_CALENDAR_COLOR,
  };
}

/**
 * Changes made without the form (spec 017 plan workspace-interactions): the
 * event moves at once, the action saves it and, if it fails, it goes back
 * with the reason (RF-4, RF-18). An occurrence asks its scope first (D10).
 */
export function useEventInteractionsState<T extends CalendarEventItem>({
  events,
  editableCalendarIds,
  calendarColors,
  timeZone,
  date,
}: {
  events: T[];
  editableCalendarIds: ReadonlySet<string>;
  calendarColors: ReadonlyMap<string, string>;
  timeZone: string;
  /** The view's date: where Ctrl/⌘+V pastes without a slot chosen (RF-59). */
  date?: string;
}): { api: EventInteractionsApi; events: T[]; dialog: ReactNode } {
  const router = useRouter();
  const { show } = useToast();
  const showUndo = useUndoToast();
  const [dragging, setDragging] = useState(false);
  useHoldLive(dragging);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [liftedId, setLiftedId] = useState<string | null>(null);
  const [menu, setMenu] = useState<{
    event: CalendarEventItem;
    at: { left: number; top: number };
    returnTo: HTMLElement;
  } | null>(null);
  const menuFor = useRef<string | null>(null);
  // The closed menu stays while it shrinks back (spec 021 RF-9, plan D3).
  const [menuOpen, setMenuOpen] = useState(false);
  const menuPresence = usePresence(menuOpen, POP_OUT_MS);
  const clipboard = useEventClipboard();
  // Alt + arrows: the event before the first key, and when to save (plan D11).
  const nudging = useRef<{
    event: CalendarEventItem;
    times: Times;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);
  const [preview, setPreview] = useState<{ id: string; times: Times } | null>(
    null,
  );
  const [overrides, setOverrides] = useState<ReadonlyMap<string, Override>>(
    () => new Map(),
  );
  const [scopeRequest, setScopeRequest] = useState<ScopeRequest | null>(null);
  // The detail card and whether its event came from `events`, so a refresh
  // that drops it means someone deleted it (spec 019 RF-44).
  const [card, setCard] = useState<{
    event: CalendarEventItem;
    anchor: Box;
    tracked: boolean;
  } | null>(null);
  // The block that opened it, where the focus goes back (RF-13).
  const cardOpener = useRef<HTMLElement | null>(null);
  const answer = useRef<((value: ScopeAnswer) => void) | null>(null);

  // Fresh server data replaces the changes already saved (plan R4).
  const [seen, setSeen] = useState(events);
  if (seen !== events) {
    setSeen(events);
    setOverrides(
      (current) =>
        new Map([...current].filter(([, override]) => override.pending)),
    );
  }

  const setOverride = useCallback((id: string, override: Override | null) => {
    setOverrides((current) => {
      const next = new Map(current);
      if (override) next.set(id, override);
      else next.delete(id);
      return next;
    });
  }, []);

  const askScope = useCallback(
    (request: ScopeRequest) =>
      new Promise<ScopeAnswer>((resolve) => {
        answer.current = resolve;
        setScopeRequest(request);
      }),
    [],
  );

  /** Runs the action, asking the scope and confirming losses for an occurrence. */
  const run = useCallback(
    async (
      event: CalendarEventItem,
      verb: ScopeRequest["verb"],
      call: (options: ScopeOptions) => Promise<QuickResult>,
    ): Promise<QuickResult | null> => {
      if (!event.seriesId) return call({});
      const chosen = await askScope({ verb, loss: null, scope: null });
      if (!chosen) return null;
      let result = await call({ scope: chosen.scope });
      if (!result.ok && result.loss) {
        const confirmed = await askScope({
          verb,
          loss: result.loss,
          scope: chosen.scope,
        });
        if (!confirmed) return null;
        result = await call({ scope: chosen.scope, confirmLoss: true });
      }
      return result;
    },
    [askScope],
  );

  const settle = useCallback(
    (event: CalendarEventItem, result: QuickResult | null, notice: string) => {
      if (!result || !result.ok) {
        // Back to its place, with the reason (RF-4); cancelled says nothing.
        // It flies there from where it is now (spec 021 RF-20).
        captureReturn(event.id);
        setOverride(event.id, null);
        if (result) show(result.error);
        if (result && !result.ok && result.gone) router.refresh();
        return;
      }
      // Saved: its block pulses once on its next paint (spec 021 RF-48).
      markPulse(event.id);
      setOverrides((current) => {
        const next = new Map(current);
        const override = next.get(event.id);
        if (override) next.set(event.id, { ...override, pending: false });
        return next;
      });
      showUndo(notice, result.undo);
      router.refresh();
    },
    [router, setOverride, show, showUndo],
  );

  const change = useCallback(
    async (event: CalendarEventItem, change: Change, notice: ChangeNotice) => {
      setOverride(event.id, { change, pending: true });
      const result = await run(event, "save", (options) =>
        quickChange(event.id, change, options),
      );
      settle(event, result, UNDO_NOTICES[notice]);
    },
    [run, setOverride, settle],
  );

  const drag = useEventDrag({
    timeZone,
    preview: (event, times) =>
      setPreview(times ? { id: event.id, times } : null),
    drop: (event, times, resized) => {
      setPreview(null);
      void change(
        event,
        { kind: "times", ...times },
        resized ? "resized" : "moved",
      );
    },
    setDragging: (event) => {
      setDragging(event !== null);
      setDraggingId(event?.id ?? null);
    },
    lift: (event) => setLiftedId(event.id),
  });

  // A press anywhere but on the lifted event puts it down (RF-11).
  useEffect(() => {
    if (!liftedId) return;
    const putDown = (event: globalThis.PointerEvent) => {
      const target = event.target as Element | null;
      if (!target?.closest?.(`[data-lifted]`)) setLiftedId(null);
    };
    window.addEventListener("pointerdown", putDown, { capture: true });
    return () =>
      window.removeEventListener("pointerdown", putDown, { capture: true });
  }, [liftedId]);

  const api = useMemo<EventInteractionsApi>(
    () => ({
      timeZone,
      canEdit: (event) => editableCalendarIds.has(event.calendarId),
      dragging,
      setDragging,
      draggingId,
      liftedId,
      startDrag: drag.start,
      openMenu: (event, at, returnTo) => {
        menuFor.current = event.id;
        setMenu({ event, at, returnTo });
        setMenuOpen(true);
      },
      isMenuOpen: (event) => menuFor.current === event.id,
      change,
      remove: async (event) => {
        setOverride(event.id, { change: "deleted", pending: true });
        const result = await run(event, "delete", (options) =>
          deleteForUndo(event.id, options),
        );
        settle(event, result, UNDO_NOTICES.deleted);
      },
      openCard: (event, anchor) => {
        cardOpener.current = anchor;
        setCard({
          event,
          anchor: boxOf(anchor),
          tracked: events.some((item) => item.id === event.id),
        });
      },
    }),
    [
      events,
      change,
      drag.start,
      dragging,
      draggingId,
      editableCalendarIds,
      liftedId,
      run,
      setOverride,
      settle,
      timeZone,
    ],
  );

  const shown = useMemo(
    () =>
      events.flatMap((event) => {
        if (preview?.id === event.id) return [{ ...event, ...preview.times }];
        const override = overrides.get(event.id);
        if (!override) return [event];
        if (override.change === "deleted") return [];
        return [
          applyOverride(
            event,
            override.change,
            calendarColors.get(event.calendarId),
          ),
        ];
      }),
    [calendarColors, events, overrides, preview],
  );

  // A nudged event is drawn in another column: keep the focus on it (RF-64).
  useEffect(() => {
    const id = nudging.current?.event.id;
    if (!id || document.activeElement?.closest(`[data-event-id="${id}"]`))
      return;
    document.querySelector<HTMLElement>(`[data-event-id="${id}"]`)?.focus();
  }, [shown]);

  useEventKeys({
    find: (id) => {
      const event = shown.find((item) => item.id === id);
      return event ? { editable: api.canEdit(event) } : null;
    },
    nudge: (id, direction) => {
      const current = nudging.current;
      const event =
        current?.event.id === id
          ? current.event
          : events.find((item) => item.id === id);
      if (!event) return;
      const times = nudge(current?.times ?? event, direction, timeZone);
      if (!times) return;
      if (current) clearTimeout(current.timer);
      setPreview({ id, times });
      // One save, one notice and one Deshacer for the whole run of keys (plan D11).
      const timer = setTimeout(() => {
        nudging.current = null;
        setPreview(null);
        void change(event, { kind: "times", ...times }, "moved");
      }, 600);
      nudging.current = { event, times, timer };
    },
    remove: (id) => {
      const event = shown.find((item) => item.id === id);
      if (event) void api.remove(event);
    },
    copy: (id) => {
      clipboard?.copy(id);
      show(UNDO_NOTICES.copied);
    },
    paste: async (target) => {
      const id = clipboard?.copied;
      if (!id) return;
      const place = target ?? (date ? { day: date } : null);
      if (!place) return;
      const result = await pasteEvent(id, place);
      if (!result.ok) {
        show(result.error);
        return;
      }
      markPulse(result.id);
      showUndo(UNDO_NOTICES.pasted, result.undo);
      router.refresh();
    },
  });

  const closeCard = useCallback((restoreFocus: boolean) => {
    const opener = cardOpener.current;
    if (restoreFocus && opener?.isConnected) opener.focus();
    setCard(null);
  }, []);
  // Someone else deleted the card's event: the refresh no longer brings it (RF-44).
  const cardGone =
    card !== null &&
    card.tracked &&
    !events.some((item) => item.id === card.event.id);
  useEffect(() => {
    if (!cardGone) return;
    show(
      takeRemoteRefresh()
        ? "Otra persona ha borrado este evento"
        : UNDO_NOTICES.deleted,
    );
  }, [cardGone, show]);

  const closeMenu = useCallback(
    (restoreFocus: boolean) => {
      menuFor.current = null;
      if (restoreFocus) menu?.returnTo.focus();
      setMenuOpen(false);
    },
    [menu],
  );

  const choose = (event: CalendarEventItem, choice: MenuChoice) => {
    if (choice.kind === "duplicate") {
      router.push(`/dashboard/events/new?from=${event.id}`);
    } else if (choice.kind === "delete") {
      void api.remove(event);
    } else {
      void api.change(event, { kind: "color", color: choice.color }, "color");
    }
  };

  const dialog = (
    <>
      {card && !cardGone ? (
        <EventCard
          // Another event is another card: placed, focused and read again (RF-12).
          key={card.event.id}
          event={card.event}
          anchor={card.anchor}
          timeZone={timeZone}
          canEdit={editableCalendarIds.has(card.event.calendarId)}
          onClose={closeCard}
          onDelete={() => {
            const event = card.event;
            setCard(null);
            void api.remove(event);
          }}
        />
      ) : null}
      {menu && menuPresence.mounted ? (
        <EventMenu
          // A menu opened elsewhere enters again instead of sliding over.
          key={`${menu.event.id}:${menu.at.left}:${menu.at.top}`}
          leaving={menuPresence.leaving}
          event={menu.event}
          at={menu.at}
          calendarColor={calendarColors.get(menu.event.calendarId)}
          onChoose={(choice) => choose(menu.event, choice)}
          onClose={closeMenu}
        />
      ) : null}
      {/* The new hours of a dragged event, read as they change (plan D2). */}
      <p role="status" aria-live="polite" className="sr-only">
        {preview ? describeTimes(preview.times, timeZone) : ""}
      </p>
      {/* Mounted only while asking: the dialog opens on mount and closes on unmount. */}
      {scopeRequest ? (
        <SeriesScopeChoice
          request={scopeRequest}
          onAnswer={(value) => {
            setScopeRequest(null);
            answer.current?.(value);
            answer.current = null;
          }}
        />
      ) : null}
    </>
  );

  return { api, events: shown, dialog };
}
