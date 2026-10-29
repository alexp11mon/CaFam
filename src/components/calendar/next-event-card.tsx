"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { formatCountdown, pickNextEvent } from "@/lib/calendar/next-event";
import { formatTime } from "@/lib/calendar/time-zone";
import { useNow } from "@/lib/hooks/use-now";

export interface NextEventItem {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  calendarId: string;
  calendarName: string;
}

// The server sends 48 h of events; past 12 h the window may run short (plan D12).
const STALE_MS = 12 * 60 * 60 * 1000;

/**
 * The next timed event of the visible calendars and how long until it starts,
 * as the one full field of accent on the screen (spec 005 RF-45..RF-50).
 */
export function NextEventCard({
  events,
  visibleCalendarIds,
  timeZone,
  loadedAt,
}: {
  events: NextEventItem[];
  visibleCalendarIds: ReadonlySet<string>;
  timeZone: string;
  loadedAt: number;
}) {
  const now = useNow();
  const router = useRouter();

  useEffect(() => {
    function onVisible() {
      if (
        document.visibilityState !== "hidden" &&
        Date.now() - loadedAt > STALE_MS
      ) {
        router.refresh();
      }
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [loadedAt, router]);

  // Until the clock exists on the client the block keeps its frame (no flash).
  const next =
    now === null
      ? null
      : pickNextEvent(events, new Date(now), visibleCalendarIds);

  if (now === null || !next) {
    return (
      <section
        aria-label="Próximo evento"
        className="flex min-h-24 flex-col justify-center gap-1 rounded-3xl glass px-5 py-4"
      >
        <h2 className="text-sm font-semibold text-muted">Próximo evento</h2>
        {now === null ? null : (
          <p className="font-semibold text-ink">
            Nada en las próximas 24 horas
          </p>
        )}
      </section>
    );
  }

  return (
    <Link
      href={`/dashboard/events/${next.id}`}
      className="flex flex-col gap-3 rounded-3xl border border-accent-edge bg-accent px-5 py-4 text-on-accent transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
    >
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold">Próximo evento</span>
        <span className="line-clamp-2 text-lg leading-tight font-bold break-words">
          {next.title}
        </span>
        <span className="text-sm tabular-nums">
          {formatTime(next.startsAt, timeZone)} · {next.calendarName}
        </span>
      </span>
      <span className="text-3xl leading-none font-extrabold tracking-tight tabular-nums">
        {formatCountdown(Date.parse(next.startsAt) - now)}
      </span>
    </Link>
  );
}
