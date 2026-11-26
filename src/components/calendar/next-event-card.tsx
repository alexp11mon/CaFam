"use client";
import { dateFormat } from "@/lib/i18n/format";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { formatCountdown, pickNextEvent } from "@/lib/calendar/next-event";
import { formatTime } from "@/lib/calendar/time-zone";
import { useNow } from "@/lib/hooks/use-now";
import { useLocale, useT } from "@/components/i18n/locale-provider";

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
  const t = useT();
  const locale = useLocale();
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

  // "Buenos días" by the hour of the profile's zone (spec 030 RF-8).
  const hour =
    now === null
      ? null
      : Number(
          dateFormat(locale, {
            hour: "numeric",
            hourCycle: "h23",
            timeZone,
          }).format(now),
        );
  const greeting =
    hour === null
      ? ""
      : hour < 6
        ? "Buenas noches"
        : hour < 13
          ? t("Buenos días")
          : hour < 21
            ? "Buenas tardes"
            : "Buenas noches";
  const day =
    now === null
      ? ""
      : dateFormat(locale, {
          weekday: "long",
          day: "numeric",
          month: "long",
          timeZone,
        }).format(now);

  const frame =
    "relative flex min-h-36 flex-col justify-between gap-3 overflow-hidden rounded-card bg-accent-gradient px-5 py-4 text-on-accent";
  const head = (
    <>
      {/* Two soft circles, as decoration only. */}
      <span
        aria-hidden="true"
        className="absolute -top-12 -right-10 size-40 rounded-full bg-on-accent/10"
      />
      <span
        aria-hidden="true"
        className="absolute right-24 -bottom-16 size-32 rounded-full bg-on-accent/10"
      />
      <span className="relative flex flex-col">
        <span className="text-xs font-medium first-letter:uppercase">
          {day}
        </span>
        <span className="text-2xl font-semibold tracking-tight">
          {greeting}
        </span>
      </span>
    </>
  );

  if (now === null || !next) {
    return (
      <section aria-label={t("Próximo evento")} className={frame}>
        {head}
        <span className="relative flex flex-col">
          <h2 className="text-xs font-medium">{t("Próximo evento")}</h2>
          {now === null ? null : (
            <p className="font-semibold">
              {t("Nada en las próximas 24 horas")}
            </p>
          )}
        </span>
      </section>
    );
  }

  return (
    <Link
      href={`/dashboard/events/${next.id}`}
      className={`${frame} transition-opacity hover:opacity-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink`}
    >
      {head}
      <span className="relative flex items-end justify-between gap-3">
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-xs font-medium">{t("Próximo evento")}</span>
          <span className="line-clamp-2 text-lg leading-tight font-semibold break-words">
            {next.title}
          </span>
          <span className="text-sm tabular-nums">
            {formatTime(next.startsAt, timeZone)} · {next.calendarName}
          </span>
        </span>
        <span className="shrink-0 rounded-full bg-on-accent/15 px-3 py-1 text-sm font-semibold tabular-nums">
          {formatCountdown(Date.parse(next.startsAt) - now)}
        </span>
      </span>
    </Link>
  );
}
