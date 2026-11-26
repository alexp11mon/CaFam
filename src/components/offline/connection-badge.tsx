"use client";

import { useState } from "react";
import { OfflineIcon, PendingIcon } from "@/components/shell/icons";
import { ChangesSheet } from "./changes-sheet";
import { useConnection } from "@/lib/hooks/use-connection";
import { useOfflineQueue, useOfflineSnapshot } from "@/lib/hooks/use-offline";
import { OFFLINE_MESSAGES } from "@/lib/offline/messages";
import { useLocale, useT } from "@/components/i18n/locale-provider";
import { dateFormat } from "@/lib/i18n/format";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locale";
import { spanishT, type T } from "@/lib/i18n/translate";

/** "Sin conexión · datos de las 18:40", with the day when the copy is older (RF-9). */
export function badgeText(
  savedAt: string | null,
  timeZone: string,
  now: Date,
  t: T = spanishT,
  locale: Locale = DEFAULT_LOCALE,
): string {
  if (!savedAt) return t(OFFLINE_MESSAGES.offline);
  const saved = new Date(savedAt);
  const day = (date: Date) =>
    dateFormat(locale, { day: "numeric", month: "short", timeZone }).format(
      date,
    );
  const time = dateFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(saved);
  return OFFLINE_MESSAGES.badge(
    time,
    day(saved) === day(now) ? null : day(saved),
    t,
  );
}

/**
 * The state of the connection and what waits on the device, in both headers
 * (spec 034 RF-9, RF-29, RF-57). Nothing while online with nothing waiting.
 * `onOpen` opens the list of changes.
 */
export function ConnectionBadge() {
  const [open, setOpen] = useState(false);
  const t = useT();
  const locale = useLocale();
  const online = useConnection();
  const { queue, conflicts, rejected } = useOfflineQueue();
  const copy = useOfflineSnapshot();
  const waiting = queue.length + conflicts.length + rejected.length;
  if (online && waiting === 0) return null;

  const text = online
    ? null
    : badgeText(
        copy?.savedAt ?? null,
        copy?.profile.timeZone ?? "Europe/Madrid",
        new Date(),
        t,
        locale,
      );
  const count = waiting > 0 ? OFFLINE_MESSAGES.pendingCount(waiting, t) : null;
  const label = [text, count].filter(Boolean).join(" · ");

  return (
    <>
      <button
        type="button"
        data-connection-badge=""
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        aria-label={label}
        title={label}
        className="inline-flex min-h-11 min-w-0 shrink items-center gap-1.5 rounded-full bg-accent-soft px-3 text-xs font-semibold text-accent-ink press-quiet disabled:cursor-default focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        {text ? <OfflineIcon /> : <PendingIcon />}
        {text ? (
          <span aria-hidden="true" className="truncate max-tab:hidden">
            {text}
          </span>
        ) : null}
        {waiting > 0 ? (
          <span aria-hidden="true" className="tabular-nums">
            {waiting}
          </span>
        ) : null}
      </button>
      <ChangesSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
