"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { signOut } from "@/app/(auth)/actions";
import { createEvent, updateEvent } from "@/app/dashboard/events/actions";
import { deleteFromDetail } from "@/app/dashboard/events/quick-actions";
import { createNote } from "@/app/dashboard/notes/actions";
import { CalendarClient } from "@/components/calendar/calendar-client";
import { EventForm } from "@/components/calendar/event-form";
import {
  DONE_MESSAGES,
  EventModalProvider,
  type EventModalApi,
} from "@/components/calendar/event-modal";
import { EventPanel } from "@/components/calendar/event-panel";
import { useUndoToast } from "@/components/calendar/use-undo-toast";
import { NoteEditor } from "@/components/notes/note-editor";
import { NoteForm } from "@/components/notes/note-form";
import { NotesBoard } from "@/components/notes/notes-board";
import { SearchScreen } from "@/components/search/search-screen";
import { AppFrame } from "@/components/shell/app-frame";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/link-button";
import { todayKey } from "@/lib/calendar/format";
import { parseViewParams } from "@/lib/calendar/ranges";
import { useConnection } from "@/lib/hooks/use-connection";
import { useOfflineQueue, useOfflineSnapshot } from "@/lib/hooks/use-offline";
import { noteAccess } from "@/lib/notes/permissions";
import * as db from "@/lib/offline/db";
import { OFFLINE_MESSAGES } from "@/lib/offline/messages";
import { loadPage } from "@/lib/offline/navigate";
import {
  detailFromSnapshot,
  newEventFromSnapshot,
  offlineCalendarProps,
  OFFLINE_SEARCH_NOTE,
  offlineNotes,
  roleIn,
  searchOffline,
} from "@/lib/offline/offline-sources";
import { loadQueue } from "@/lib/offline/queue-store";
import type { Snapshot } from "@/lib/offline/snapshot";
import { setSnapshot } from "@/lib/offline/snapshot-store";
import {
  matchRoute,
  navigateOffline,
  OfflineRouter,
  safeFrom,
  useOfflineLocation,
} from "./offline-router";

const PAGE =
  "mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-4 py-6 max-tab:gap-2 max-tab:pt-1 max-tab:pb-0 sm:px-6";
const NARROW = "mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-6";

/** Closing an event form or detail goes back to the calendar here (spec 008 RF-8). */
function useOfflineModal(): EventModalApi {
  const showUndo = useUndoToast();
  return useMemo(
    () => ({
      setDirty: () => {},
      requestClose: () => navigateOffline("/dashboard/calendar"),
      finish: (done, undo) => {
        showUndo(DONE_MESSAGES[done], undo);
        navigateOffline("/dashboard/calendar");
      },
      expand: () => {},
    }),
    [showUndo],
  );
}

function NeedsNetwork() {
  return (
    <main className={NARROW}>
      <Card>
        <EmptyState
          title={OFFLINE_MESSAGES.needsNetwork}
          action={
            <LinkButton href="/dashboard/calendar">Ir al calendario</LinkButton>
          }
        >
          {OFFLINE_MESSAGES.needsNetworkPage}
        </EmptyState>
      </Card>
    </main>
  );
}

function Calendar({ copy, search }: { copy: Snapshot; search: string }) {
  // Built once per copy: a new window would take the view back (spec 024).
  const props = useMemo(() => offlineCalendarProps(copy), [copy]);
  const params = new URLSearchParams(search);
  const { view, date } = parseViewParams(
    {
      view: params.get("view") ?? undefined,
      date: params.get("date") ?? undefined,
    },
    props.today,
    copy.profile.lastView,
  );
  return (
    <main className={PAGE}>
      <h1 className="text-2xl font-semibold text-ink max-tab:sr-only">
        Calendario
      </h1>
      <CalendarClient
        {...props}
        initialView={view}
        initialDate={date}
        availableRange={copy.range}
        createAction={createEvent}
      />
    </main>
  );
}

function EventScreen({ copy, id }: { copy: Snapshot; id: string }) {
  const { queue } = useOfflineQueue();
  const modal = useOfflineModal();
  const data = useMemo(
    () => detailFromSnapshot(copy, queue, id),
    [copy, queue, id],
  );
  // Deleting it here queues the deletion, which hides the event before the
  // button can close the screen: keep showing the last version (T12).
  const [shown, setShown] = useState(data);
  if (data && data !== shown) setShown(data);
  const view = data ?? shown;
  if (!view) return <NeedsNetwork />;
  return (
    <main className={NARROW}>
      <EventModalProvider value={modal}>
        <EventPanel
          {...view}
          updateAction={updateEvent.bind(null, id)}
          deleteAction={deleteFromDetail.bind(null, id)}
        />
      </EventModalProvider>
    </main>
  );
}

function NewEvent({ copy, search }: { copy: Snapshot; search: string }) {
  const { queue } = useOfflineQueue();
  const modal = useOfflineModal();
  const [form] = useState(() =>
    newEventFromSnapshot(
      copy,
      queue,
      Object.fromEntries(new URLSearchParams(search)),
    ),
  );
  if (!form) return <NeedsNetwork />;
  return (
    <main className={NARROW}>
      <h1 className="text-2xl font-semibold text-ink">Nuevo evento</h1>
      <EventModalProvider value={modal}>
        <EventForm
          action={createEvent}
          initial={form.initial}
          calendars={form.calendars}
          categories={form.categories}
          submitLabel="Crear evento"
          pendingLabel="Creando…"
          cancelHref="/dashboard/calendar"
          focusTitle
          timeZone={copy.profile.timeZone}
          // Pure: the phrase is read offline too (spec 041 RF-14).
          phrase={
            new URLSearchParams(search).has("from")
              ? undefined
              : {
                  timeZone: copy.profile.timeZone,
                  defaultMinutes: copy.profile.duration,
                }
          }
        />
      </EventModalProvider>
    </main>
  );
}

const writableCalendars = (copy: Snapshot) =>
  copy.calendars
    .filter((c) => c.role !== "viewer" && !c.synced)
    .map(({ id, name }) => ({ id, name }));

function NoteScreen({ copy, id }: { copy: Snapshot; id: string }) {
  const { queue } = useOfflineQueue();
  const note = useMemo(
    () => offlineNotes(copy, queue).find((n) => n.id === id) ?? null,
    [copy, queue, id],
  );
  if (!note) return <NeedsNetwork />;
  return (
    <main className={NARROW}>
      <NoteEditor
        note={note}
        access={noteAccess(note, copy.userId, roleIn(copy, note.calendarId))}
        calendars={writableCalendars(copy)}
        today={todayKey(copy.profile.timeZone)}
        userId={copy.userId}
      />
    </main>
  );
}

/** "Buscar" on the device's copy (spec 039 RF-10). */
function OfflineSearch({
  copy,
  query,
}: {
  copy: Snapshot;
  query: string | null;
}) {
  const search = useMemo(
    () => async (text: string) => searchOffline(copy, text),
    [copy],
  );
  const hidden = new Set(
    copy.preferences.calendarPreferences
      .filter((preference) => !preference.visible)
      .map((preference) => preference.calendarId),
  );
  return (
    <main className={NARROW}>
      <h1 className="text-2xl font-semibold text-ink max-tab:sr-only">
        Buscar
      </h1>
      <SearchScreen
        initialQuery={query ?? ""}
        timeZone={copy.profile.timeZone}
        calendars={copy.calendars.map((calendar) => ({
          id: calendar.id,
          name: calendar.name,
          color: calendar.color,
          hidden: hidden.has(calendar.id),
        }))}
        search={search}
        note={OFFLINE_SEARCH_NOTE}
      />
    </main>
  );
}

function Screen({ copy }: { copy: Snapshot }) {
  const location = useOfflineLocation();
  const url = new URL(location, "http://local");
  const route = matchRoute(url.pathname) ?? { kind: "calendar" as const };
  switch (route.kind) {
    case "calendar":
      return <Calendar copy={copy} search={url.search} />;
    case "event":
      return <EventScreen key={route.id} copy={copy} id={route.id} />;
    case "newEvent":
      return <NewEvent key={url.search} copy={copy} search={url.search} />;
    case "notes":
      return (
        <main className={NARROW}>
          <h1 className="text-2xl font-semibold text-ink">Notas</h1>
          <NotesBoard
            notes={copy.notes}
            today={todayKey(copy.profile.timeZone)}
            userId={copy.userId}
          />
        </main>
      );
    case "newNote":
      return (
        <main className={NARROW}>
          <h1 className="text-2xl font-semibold text-ink">Nueva nota</h1>
          <NoteForm action={createNote} calendars={writableCalendars(copy)} />
        </main>
      );
    case "note":
      return <NoteScreen key={route.id} copy={copy} id={route.id} />;
    case "search":
      return <OfflineSearch copy={copy} query={url.searchParams.get("q")} />;
    default:
      return <NeedsNetwork />;
  }
}

/** Back with a connection and nothing left to send: the real page (RF-38). */
function BackOnline() {
  const online = useConnection();
  const { queue } = useOfflineQueue();
  const [wasOffline, setWasOffline] = useState(!online);
  if (!online && !wasOffline) setWasOffline(true);
  useEffect(() => {
    if (online && wasOffline && queue.length === 0) {
      loadPage(window.location.pathname + window.location.search);
    }
  }, [online, wasOffline, queue.length]);
  return null;
}

/**
 * CaFam without a connection (spec 034 RF-7, RF-8, RF-12, RF-16, plan D3):
 * the static /offline page mounts it; with a copy of an account it draws the
 * frame and the screen of the address it came from, from IndexedDB. Without
 * one, `fallback` is the "Sin conexión" screen of always.
 */
export function OfflineApp({ fallback }: { fallback: ReactNode }) {
  const [state, setState] = useState<"loading" | "none" | "ready">("loading");
  const copy = useOfflineSnapshot();

  useEffect(() => {
    // The address it came from, so links, reloads and the calendar see it.
    window.history.replaceState(null, "", safeFrom(window.location.search));
    void (async () => {
      try {
        const saved = await db.loadState();
        if (!saved.snapshot) return setState("none");
        await setSnapshot(saved.snapshot);
        await loadQueue();
        setState("ready");
      } catch {
        setState("none");
      }
    })();
  }, []);

  if (state === "loading") return null;
  if (state === "none" || !copy) return fallback;
  return (
    <AppFrame
      accent={copy.profile.accent}
      theme={copy.profile.theme}
      displayName={copy.profile.displayName}
      userId={copy.userId}
      signOutAction={signOut}
      offline
    >
      <OfflineRouter />
      <BackOnline />
      <Screen copy={copy} />
    </AppFrame>
  );
}
