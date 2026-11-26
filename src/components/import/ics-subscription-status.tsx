"use client";

import { useState, useTransition } from "react";
import {
  refreshIcsSubscription,
  stopIcsSubscription,
} from "@/app/dashboard/calendars/ics-actions";
import { Button } from "@/components/ui/button";
import { relativeTime } from "@/lib/comments/relative-time";
import { useNow } from "@/lib/hooks/use-now";
import type { IcsSubscriptionInfo } from "@/lib/ics/subscription-queries";
import { useLocale, useT } from "@/components/i18n/locale-provider";

/**
 * "Actualizado desde un enlace · hace 2 h" in "Mis calendarios", with
 * "Actualizar ahora" (or "Reintentar" when paused) and "Dejar de actualizar"
 * for Owner and Editors (spec 044 RF-6, RF-10).
 */
export function IcsSubscriptionStatus({
  calendarId,
  calendarName,
  info,
  canWrite,
  timeZone,
}: {
  calendarId: string;
  calendarName: string;
  info: IcsSubscriptionInfo;
  canWrite: boolean;
  timeZone: string;
}) {
  const t = useT();
  const locale = useLocale();
  const now = useNow();
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const paused = info.state === "paused";

  const run = (action: (id: string) => Promise<{ message: string }>) =>
    startTransition(async () => {
      setMessage((await action(calendarId)).message);
    });

  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm text-muted tabular-nums">
        {paused
          ? t("La actualización desde un enlace está en pausa.")
          : info.lastReadAt && now !== null
            ? t("Actualizado desde un enlace · {when}", {
                when: relativeTime(
                  info.lastReadAt,
                  new Date(now),
                  timeZone,
                  locale,
                ),
              })
            : t("Se actualiza desde un enlace.")}
        {info.lastError
          ? ` ${t("Último fallo: {error}", { error: t(info.lastError) })}`
          : null}
      </p>
      {canWrite ? (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            disabled={pending}
            aria-label={t(
              paused
                ? "Reintentar {calendarName}"
                : "Actualizar ahora {calendarName}",
              { calendarName },
            )}
            onClick={() => run(refreshIcsSubscription)}
          >
            {paused ? t("Reintentar") : "Actualizar ahora"}
          </Button>
          <Button
            variant="quiet"
            disabled={pending}
            aria-label={t("Dejar de actualizar {calendarName}", {
              calendarName,
            })}
            onClick={() => run(stopIcsSubscription)}
          >
            {t("Dejar de actualizar")}
          </Button>
        </div>
      ) : null}
      <p aria-live="polite" className="text-sm text-ink">
        {message}
      </p>
    </div>
  );
}
