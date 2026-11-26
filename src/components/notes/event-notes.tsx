"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import type { EventNote } from "@/app/dashboard/notes/actions";
import { LinkButton } from "@/components/ui/link-button";
import { useT } from "@/components/i18n/locale-provider";

/**
 * "Notas" of an event's detail: the linked notes the user sees, with their
 * progress, and "Añadir nota" (spec 048 RF-9, RF-10). Read after opening, as
 * the comments.
 */
export function EventNotes({
  eventId,
  loadNotes,
}: {
  eventId: string;
  loadNotes: (
    eventId: string,
  ) => Promise<{ notes: EventNote[] } | { error: string }>;
}) {
  const t = useT();
  const headingId = useId();
  const [state, setState] = useState<{
    eventId: string;
    notes?: EventNote[];
    error?: string;
  }>({ eventId });
  // Another event in the same window starts again.
  if (state.eventId !== eventId) setState({ eventId });

  useEffect(() => {
    let dropped = false;
    loadNotes(eventId)
      .then((result) => {
        if (!dropped) setState({ eventId, ...result });
      })
      .catch(() => {
        if (!dropped)
          setState({ eventId, error: t("No se han podido cargar las notas.") });
      });
    return () => {
      dropped = true;
    };
  }, [eventId, loadNotes, t]);

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h2 id={headingId} className="text-base font-semibold text-ink">
          {t("Notas")}
        </h2>
        <LinkButton
          href={`/dashboard/notes/new?event=${encodeURIComponent(eventId)}`}
          variant="quiet"
          className="min-h-11 px-3 text-sm"
        >
          {t("Añadir nota")}
        </LinkButton>
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : state.notes === undefined ? (
        <p className="text-sm text-muted">{t("Cargando…")}</p>
      ) : state.notes.length === 0 ? (
        <p className="text-sm text-muted">{t("Sin notas")}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {state.notes.map((note) => (
            <li key={note.id}>
              <Link
                href={`/dashboard/notes/${note.id}`}
                prefetch={false}
                className="flex min-h-11 items-center justify-between gap-3 rounded-control px-2 text-ink hover:bg-stone focus-visible:outline-2 focus-visible:outline-ink"
              >
                <span className="min-w-0 truncate">
                  {note.title || t("(Sin título)")}
                </span>
                {note.done?.total ? (
                  <span className="shrink-0 text-sm text-muted tabular-nums">
                    {note.done.done}/{note.done.total}
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
