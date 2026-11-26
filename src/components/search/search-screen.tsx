"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Venito } from "@/components/brand/venito";
import { EventBlock } from "@/components/calendar/event-block";
import { CloseIcon, SearchIcon } from "@/components/shell/icons";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { lineOf } from "@/lib/calendar/agenda-feed";
import { formatDateKeyFull } from "@/lib/calendar/format";
import { groupResults, type SearchGroup } from "@/lib/search/group";
import { excerpt, highlight } from "@/lib/search/highlight";
import { MIN_QUERY, SEARCH_DEBOUNCE_MS } from "@/lib/search/limits";
import type { SearchResult } from "@/lib/search/queries";
import { addRecent, readRecent, removeRecent } from "@/lib/search/recent";
import { useLocale, useT } from "@/components/i18n/locale-provider";

export type SearchFn = (
  query: string,
  moreBack: number,
) => Promise<{ results: SearchResult[]; more: boolean }>;

export interface SearchCalendar {
  id: string;
  name: string;
  color: string;
  /** Hidden by the filters: the search finds it anyway (RF-4, plan D3). */
  hidden: boolean;
}

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "done"; results: SearchResult[]; more: boolean; at: number };

const capitalize = (text: string) =>
  text.charAt(0).toUpperCase() + text.slice(1);

const ROUND =
  "flex size-11 shrink-0 items-center justify-center rounded-full press-quiet focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

/** The comment that matched, with the words marked (RF-7). */
function Excerpt({ text, query }: { text: string; query: string }) {
  const t = useT();
  return (
    <p className="truncate px-1 text-sm text-muted">
      <span className="sr-only">{t("Comentario:")} </span>
      {highlight(excerpt(text, query), query).map((piece, index) =>
        piece.mark ? (
          <mark
            key={index}
            className="rounded-block bg-accent-soft text-accent-ink"
          >
            {piece.text}
          </mark>
        ) : (
          <span key={index}>{piece.text}</span>
        ),
      )}
    </p>
  );
}

/**
 * The event search (spec 039 RF-2, RF-6 to RF-9, RF-12): as you type, by
 * day, upcoming first and past ones after. `search` is the server action or,
 * without a connection, the device copy (RF-10).
 */
export function SearchScreen({
  initialQuery,
  timeZone,
  calendars,
  search,
  note,
}: {
  initialQuery: string;
  timeZone: string;
  calendars: SearchCalendar[];
  search: SearchFn;
  /** Above the results, e.g. the offline range (RF-10). */
  note?: string;
}) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const fieldId = useId();
  const field = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(initialQuery);
  const [moreBack, setMoreBack] = useState(0);
  const [state, setState] = useState<State>({ kind: "idle" });
  const [recent, setRecent] = useState<string[]>([]);
  const [attempt, setAttempt] = useState(0);
  const byId = new Map(calendars.map((calendar) => [calendar.id, calendar]));
  const text = query.trim();

  useEffect(() => {
    field.current?.focus();
  }, []);

  // Only on this device, so it is read in the browser (plan D5).
  useEffect(() => {
    const timer = setTimeout(() => setRecent(readRecent()), 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape" || document.querySelector("dialog[open]"))
        return;
      if (window.history.length > 1) router.back();
      else router.push("/dashboard/calendar");
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [router]);

  useEffect(() => {
    // The address can be shared and reloaded (RF-2).
    const url = text
      ? `?q=${encodeURIComponent(text)}`
      : window.location.pathname;
    window.history.replaceState(window.history.state, "", url);
    let live = true;
    const timer = setTimeout(
      () => {
        if (text.length < MIN_QUERY) {
          setState({ kind: "idle" });
          return;
        }
        setState({ kind: "loading" });
        search(text, moreBack).then(
          ({ results, more }) => {
            if (!live) return;
            setRecent(addRecent(text));
            setState({ kind: "done", results, more, at: Date.now() });
          },
          () => {
            if (live) setState({ kind: "error" });
          },
        );
      },
      text.length < MIN_QUERY ? 0 : SEARCH_DEBOUNCE_MS,
    );
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [text, moreBack, attempt, search]);

  function close() {
    if (window.history.length > 1) router.back();
    else router.push("/dashboard/calendar");
  }

  const done = state.kind === "done" ? state : null;
  const groups = done
    ? groupResults(done.results, timeZone, new Date(done.at))
    : null;
  const count = done?.results.length ?? 0;

  function section(label: string, list: SearchGroup<SearchResult>[]) {
    if (list.length === 0) return null;
    return (
      <section aria-label={label} className="flex flex-col gap-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
          {label}
        </h2>
        {list.map((group) => (
          <div key={group.day} className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-ink">
              {capitalize(formatDateKeyFull(group.day, locale))}
            </h3>
            <ul className="flex flex-col gap-3">
              {group.events.map((result) => {
                const calendar = byId.get(result.calendarId);
                return (
                  <li key={result.id} className="flex flex-col gap-1">
                    <EventBlock
                      event={{
                        ...result,
                        color: result.color ?? calendar?.color ?? "#A0C4FF",
                      }}
                      timeZone={timeZone}
                      shape="card"
                      line={lineOf(result, timeZone)}
                    />
                    <p className="px-1 text-sm text-muted">
                      {calendar?.name ?? t("Calendario")}
                      {calendar?.hidden ? (
                        <>
                          {" · "}
                          <span>{t("Oculto en el calendario")}</span>
                        </>
                      ) : null}
                    </p>
                    {result.matchedComment ? (
                      <Excerpt text={result.matchedComment} query={text} />
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <label htmlFor={fieldId} className="sr-only">
          {t("Buscar eventos")}
        </label>
        <div className="flex min-h-11 flex-1 items-center gap-2 rounded-control border border-control bg-paper px-3 text-muted focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ink">
          <SearchIcon />
          <input
            ref={field}
            id={fieldId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("Título, lugar, descripción o comentario")}
            autoComplete="off"
            enterKeyHint="search"
            className="min-w-0 flex-1 bg-transparent py-2 text-base text-ink outline-none placeholder:text-muted"
          />
        </div>
        <button
          type="button"
          onClick={close}
          aria-label={t("Cerrar")}
          className={`${ROUND} text-ink hover:bg-paper`}
        >
          <CloseIcon />
        </button>
      </div>

      {note ? <p className="text-sm text-muted">{note}</p> : null}

      <p role="status" aria-live="polite" className="sr-only">
        {done
          ? count === 0
            ? t("Sin resultados")
            : `${count} ${count === 1 ? "resultado" : "resultados"}`
          : ""}
      </p>

      {state.kind === "idle" && recent.length > 0 ? (
        <section
          aria-label={t("Búsquedas recientes")}
          className="flex flex-col gap-1"
        >
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
            {t("Búsquedas recientes")}
          </h2>
          <ul className="flex flex-col">
            {recent.map((item) => (
              <li key={item} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setQuery(item)}
                  className="flex min-h-11 flex-1 items-center rounded-control px-2 text-left text-ink press-quiet hover:bg-paper focus-visible:outline-2 focus-visible:outline-ink"
                >
                  {item}
                </button>
                <button
                  type="button"
                  aria-label={t("Quitar «{item}»", { item })}
                  onClick={() => setRecent(removeRecent(item))}
                  className={`${ROUND} text-muted hover:bg-paper hover:text-ink`}
                >
                  <CloseIcon />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {state.kind === "loading" ? (
        <p className="text-muted">{t("Buscando…")}</p>
      ) : null}

      {state.kind === "error" ? (
        <div className="flex flex-col items-start gap-3">
          <p role="alert" className="text-danger">
            {t("No se ha podido buscar.")}
          </p>
          <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
            {t("Reintentar")}
          </Button>
        </div>
      ) : null}

      {done && count === 0 ? (
        <EmptyState
          title={t("Sin resultados")}
          art={<Venito mood="confused" className="size-24" />}
        >
          {t("Prueba con otra palabra o busca más atrás en el tiempo.")}
        </EmptyState>
      ) : null}

      {groups ? (
        <>
          {section(t("Próximos"), groups.upcoming)}
          {section(t("Pasados"), groups.past)}
        </>
      ) : null}

      {done?.more ? (
        <p className="text-sm text-muted">
          {t("Hay más resultados: afina la búsqueda")}
        </p>
      ) : null}

      {done ? (
        <div>
          <Button variant="quiet" onClick={() => setMoreBack((n) => n + 1)}>
            {t("Buscar más atrás")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
