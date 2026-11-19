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
          ? "La actualización desde un enlace está en pausa."
          : info.lastReadAt && now !== null
            ? `Actualizado desde un enlace · ${relativeTime(info.lastReadAt, new Date(now), timeZone)}`
            : "Se actualiza desde un enlace."}
        {info.lastError ? ` Último fallo: ${info.lastError}` : null}
      </p>
      {canWrite ? (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            disabled={pending}
            aria-label={`${paused ? "Reintentar" : "Actualizar ahora"} ${calendarName}`}
            onClick={() => run(refreshIcsSubscription)}
          >
            {paused ? "Reintentar" : "Actualizar ahora"}
          </Button>
          <Button
            variant="quiet"
            disabled={pending}
            aria-label={`Dejar de actualizar ${calendarName}`}
            onClick={() => run(stopIcsSubscription)}
          >
            Dejar de actualizar
          </Button>
        </div>
      ) : null}
      <p aria-live="polite" className="text-sm text-ink">
        {message}
      </p>
    </div>
  );
}
