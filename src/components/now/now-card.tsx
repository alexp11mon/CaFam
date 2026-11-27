"use client";

import Link from "next/link";
import { useId } from "react";
import { useLocale, useT } from "@/components/i18n/locale-provider";
import { zonedDateKey } from "@/lib/calendar/time-zone";
import { dateFormat } from "@/lib/i18n/format";
import type { NowCardData, NowEvent, NowState } from "@/lib/now/cards";

const LINK =
  "rounded-control focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink";

/**
 * One person in "Ahora": all-day events of today, what is on now and what
 * comes next (spec 054 RF-7 to RF-18). Only links: nothing to create, move or
 * delete here (RF-18).
 */
export function NowCard({
  card,
  day,
  timeZone,
}: {
  card: NowCardData;
  /** Today in the profile's zone, YYYY-MM-DD. */
  day: string;
  timeZone: string;
}) {
  const t = useT();
  const locale = useLocale();
  const headingId = useId();
  const time = (iso: string) =>
    dateFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone }).format(
      Date.parse(iso),
    );
  const name = card.person.name || t("Persona desconocida");
  const { current, next } = card;

  return (
    <section
      aria-labelledby={headingId}
      className="surface flex min-w-0 flex-col gap-3 rounded-card p-4"
    >
      <h2 id={headingId} className="text-lg font-semibold text-ink">
        <Link
          href={`/dashboard/calendar?view=day&date=${day}&only=${card.person.id}`}
          prefetch={false}
          className={`${LINK} hover:underline`}
        >
          {card.person.isMe ? t("{name} (tú)", { name }) : name}
        </Link>
      </h2>
      {/* Speaks only when the kind of state changes, not every minute (D8). */}
      <p role="status" className="sr-only">
        {announce(current, name, t)}
      </p>

      {card.today.length > 0 && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
          <span className="font-medium">{t("Hoy")}</span>
          {card.today.map((event) => (
            <EventLink key={event.id} event={event} className="text-ink" />
          ))}
        </p>
      )}

      <div className="flex flex-col gap-1">
        <h3 className="text-xs font-medium tracking-wide text-muted uppercase">
          {t("Ahora")}
        </h3>
        {current.kind === "event" ? (
          <ul className="flex flex-col gap-2">
            {current.events.map((event) => (
              <li key={event.id} className="flex min-w-0 flex-col">
                <EventLink event={event} className="font-semibold text-ink" />
                <span className="text-sm text-muted tabular-nums">
                  {[
                    event.calendarName,
                    event.location,
                    t("hasta las {time}", { time: time(event.endsAt) }),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </li>
            ))}
            {current.more > 0 && (
              <li className="text-sm text-muted">
                {t("+{n} más", { n: current.more })}
              </li>
            )}
          </ul>
        ) : (
          <p className="font-semibold text-ink tabular-nums">
            {current.kind === "busy"
              ? t("Ocupado hasta las {time}", { time: time(current.until) })
              : current.kind === "noData"
                ? t("Sin datos sin conexión")
                : current.until
                  ? t("Libre hasta las {time}", { time: time(current.until) })
                  : t("Libre")}
          </p>
        )}
      </div>

      {!card.busyOnly && (
        <div className="flex flex-col gap-1">
          <h3 className="text-xs font-medium tracking-wide text-muted uppercase">
            {t("Después")}
          </h3>
          {next ? (
            <p className="flex min-w-0 items-baseline gap-2">
              <span className="shrink-0 text-sm text-muted tabular-nums">
                {zonedDateKey(next.startsAt, timeZone) === day
                  ? time(next.startsAt)
                  : t("Mañana, {time}", { time: time(next.startsAt) })}
              </span>
              <EventLink event={next} className="text-ink" />
            </p>
          ) : (
            <p className="text-sm text-muted">{t("Nada más hoy ni mañana")}</p>
          )}
        </div>
      )}
    </section>
  );
}

function EventLink({
  event,
  className,
}: {
  event: NowEvent;
  className: string;
}) {
  return (
    <Link
      href={`/dashboard/events/${event.id}`}
      prefetch={false}
      className={`${LINK} inline-flex min-w-0 items-center gap-2 hover:underline ${className}`}
    >
      <span
        aria-hidden="true"
        className="size-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: event.color }}
      />
      <span className="truncate">{event.title}</span>
    </Link>
  );
}

function announce(
  state: NowState,
  name: string,
  t: ReturnType<typeof useT>,
): string {
  switch (state.kind) {
    case "event":
      return t("{name} tiene algo ahora", { name });
    case "busy":
      return t("{name} está ocupado", { name });
    case "free":
      return t("{name} está libre", { name });
    case "noData":
      return "";
  }
}
