"use client";

import { useId, useMemo, useState } from "react";
import { useOfflineQueue } from "@/lib/hooks/use-offline";
import { pendingNotes, type PendingNote } from "@/lib/offline/overlay";
import { SearchIcon } from "@/components/shell/icons";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/link-button";
import { useLiveCalendar } from "@/lib/hooks/use-live-calendar";
import { sortNotes } from "@/lib/notes/order";
import { filterNotes, type NoteFilter } from "@/lib/notes/search";
import type { Note } from "@/lib/notes/types";
import { NoteCard } from "./note-card";
import { useT } from "@/components/i18n/locale-provider";

const FILTERS: { id: NoteFilter; label: string }[] = [
  { id: "all", label: "Todas" },
  { id: "list", label: "Listas" },
  { id: "text", label: "Textos" },
  { id: "archived", label: "Archivadas" },
];

/**
 * The list of notes (spec 028 RF-1 to RF-3): a search that filters as it is
 * typed, the filters and the cards, pinned first. Someone else's change, or
 * one made on another device, comes in by the calendar's live channel (RF-12).
 */
export function NotesBoard({
  notes: fromServer,
  today,
  userId,
}: {
  notes: Note[];
  /** Today in the profile's zone, for "Para hoy" and what is late. */
  today: string;
  userId: string;
}) {
  const t = useT();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<NoteFilter>("all");
  const searchId = useId();
  useLiveCalendar(userId);
  // What waits on the device, as it will be (spec 034 RF-37).
  const { queue } = useOfflineQueue();
  const notes: PendingNote[] = useMemo(
    () =>
      queue.length === 0
        ? fromServer
        : pendingNotes(fromServer, queue, new Date().toISOString(), userId),
    [fromServer, queue, userId],
  );

  const shown = sortNotes(filterNotes(notes, filter, query));
  const nothingYet = notes.length === 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <div className="relative">
          <label htmlFor={searchId} className="sr-only">
            {t("Buscar en tus notas")}
          </label>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-muted"
          >
            <SearchIcon />
          </span>
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("Buscar en tus notas")}
            className="min-h-12 w-full rounded-control border border-control bg-paper py-2.5 pr-4 pl-12 text-base text-ink outline-none placeholder:text-muted focus-visible:border-ink focus-visible:ring-2 focus-visible:ring-ink/20"
          />
        </div>
        <ul
          aria-label={t("Qué notas se ven")}
          className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]"
        >
          {FILTERS.map((item) => (
            <li key={item.id}>
              <Chip
                selected={filter === item.id}
                onClick={() => setFilter(item.id)}
              >
                {item.label}
              </Chip>
            </li>
          ))}
        </ul>
      </div>

      {/* How many there are, for who cannot see the cards change. */}
      <p role="status" className="sr-only">
        {nothingYet
          ? ""
          : shown.length === 1
            ? "1 nota"
            : `${shown.length} notas`}
      </p>

      {nothingYet ? (
        <EmptyState
          title={t("Todavía no tienes notas")}
          action={
            <LinkButton href="/dashboard/notes/new">
              {t("Nueva nota")}
            </LinkButton>
          }
        >
          {t(
            "Apunta aquí la compra, los deberes o lo pendiente del trabajo, y táchalo cuando esté hecho.",
          )}
        </EmptyState>
      ) : shown.length === 0 ? (
        <EmptyState
          title={
            query.trim()
              ? t("Ninguna nota con esas palabras")
              : filter === "archived"
                ? t("No hay notas archivadas")
                : t("Ninguna nota de este tipo")
          }
        >
          {query.trim()
            ? t("Prueba con otra palabra o quita el filtro.")
            : t("Las notas que archives aparecerán aquí.")}
        </EmptyState>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((note) => (
            <li key={note.id}>
              <NoteCard note={note} today={today} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
