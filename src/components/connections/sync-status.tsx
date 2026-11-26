"use client";

import type { SyncedCalendarView } from "@/lib/sync/queries";
import { useLocale, useT } from "@/components/i18n/locale-provider";
import { dateFormat } from "@/lib/i18n/format";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locale";
import { summaryText, syncErrorText } from "@/lib/sync/summary";
import type { ProviderName } from "@/lib/sync/providers/types";

export function formatWhen(
  iso: string,
  timeZone: string,
  locale: Locale = DEFAULT_LOCALE,
) {
  return dateFormat(locale, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(new Date(iso));
}

/** State of each synced calendar: last good update, failure or gone (RF-13, RF-26, RF-33). */
export function SyncStatus({
  calendars,
  timeZone,
  provider = "google",
}: {
  calendars: SyncedCalendarView[];
  timeZone: string;
  provider?: ProviderName;
}) {
  const t = useT();
  const locale = useLocale();
  return (
    <ul className="flex flex-col gap-3">
      {calendars.map((calendar) => (
        <li
          key={calendar.calendarId}
          className="flex flex-col gap-1 rounded-card bg-paper p-4 text-sm text-ink"
        >
          <span className="font-semibold">{calendar.name}</span>
          {calendar.state === "missing" ? (
            <span className="text-danger">
              {syncErrorText("missing", provider, t)}
            </span>
          ) : (
            <>
              <span className="tabular-nums">
                {calendar.lastSyncedAt
                  ? t("Última actualización correcta: {when}.", {
                      when: formatWhen(calendar.lastSyncedAt, timeZone, locale),
                    })
                  : t("Todavía no se ha actualizado correctamente.")}
              </span>
              {calendar.lastError && calendar.lastError !== "missing" ? (
                <span className="text-danger">
                  {syncErrorText(
                    calendar.lastError === "revoked" ? "revoked" : "transient",
                    provider,
                    t,
                  )}
                </span>
              ) : calendar.lastSummary ? (
                <span className="text-muted">
                  {summaryText(calendar.lastSummary, t)}
                </span>
              ) : null}
            </>
          )}
        </li>
      ))}
    </ul>
  );
}
