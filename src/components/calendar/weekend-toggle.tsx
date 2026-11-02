"use client";

import { useState, useTransition } from "react";
import { setShowWeekends } from "@/app/dashboard/settings/actions";
import { CALENDAR_MESSAGES } from "@/lib/calendar/error-messages";

/**
 * Shows the weekends again without going to Ajustes (spec 019 RF-28). Only
 * drawn while they are hidden; the action revalidates the calendar.
 */
export function WeekendToggle({ className = "" }: { className?: string }) {
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(undefined);
            try {
              const result = await setShowWeekends(true);
              if (result.error) setError(result.error);
            } catch {
              setError(CALENDAR_MESSAGES.connection);
            }
          })
        }
        className={className}
      >
        Mostrar fines de semana
      </button>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
