"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { Select } from "@/components/ui/select";
import { CloseIcon } from "@/components/shell/icons";
import { MAX_REMINDERS, reminderOptions, validFor } from "@/lib/push/options";
import { useT } from "@/components/i18n/locale-provider";

// Personal reminders of an event (spec 040 RF-5 to RF-7).

export interface ReminderDefaults {
  timed: number | null;
  allDay: number | null;
}

function ReminderList({
  allDay,
  value,
  onChange,
  disabled = false,
}: {
  allDay: boolean;
  value: number[];
  onChange: (next: number[]) => void;
  disabled?: boolean;
}) {
  const t = useT();
  const options = reminderOptions(allDay);
  // A new one starts at the usual choice (10 minutes, the day before).
  const preferred = allDay ? 1440 : 10;
  const unused = value.includes(preferred)
    ? options.find((o) => !value.includes(o.minutes))
    : { minutes: preferred };
  return (
    <div className="flex flex-col gap-2">
      {value.length === 0 ? (
        <p className="text-sm text-muted">{t("Sin avisos")}</p>
      ) : null}
      {value.map((minutes, index) => (
        <div key={index} className="flex items-end gap-2">
          <div className="flex-1">
            <Select
              label={t("Aviso {value}", { value: index + 1 })}
              name={`reminder-${index}`}
              value={String(minutes)}
              disabled={disabled}
              onChange={(event) =>
                onChange(
                  value.map((m, i) =>
                    i === index ? Number(event.target.value) : m,
                  ),
                )
              }
            >
              {options.map((o) => (
                <option key={o.minutes} value={o.minutes}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
          <Button
            variant="quiet"
            aria-label={t("Quitar el aviso {value}", { value: index + 1 })}
            disabled={disabled}
            onClick={() => onChange(value.filter((_, i) => i !== index))}
          >
            <CloseIcon />
          </Button>
        </div>
      ))}
      {value.length < MAX_REMINDERS && unused ? (
        <Button
          variant="secondary"
          className="self-start"
          disabled={disabled}
          onClick={() => onChange([...value, unused.minutes])}
        >
          {t("Añadir aviso")}
        </Button>
      ) : null}
    </div>
  );
}

/**
 * In the new and edit forms: sends `reminders` ("none" or "10,60"). A new
 * event starts with the default of its kind until the user touches it (RF-6).
 */
export function ReminderField({
  allDay,
  initial,
  defaults,
}: {
  allDay: boolean;
  initial?: number[];
  defaults?: ReminderDefaults;
}) {
  const t = useT();
  const [touched, setTouched] = useState<number[] | null>(initial ?? null);
  const fallback = defaults
    ? [allDay ? defaults.allDay : defaults.timed].filter(
        (m): m is number => m !== null,
      )
    : [];
  const value = validFor(allDay, touched ?? fallback);
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium text-ink">
        {t("Avisos")}
      </legend>
      <ReminderList allDay={allDay} value={value} onChange={setTouched} />
      <input
        type="hidden"
        name="reminders"
        value={value.length ? value.join(",") : "none"}
      />
    </fieldset>
  );
}

/** "Avisarme" in the detail: saved at once, undone if saving fails (RF-7). */
export function EventReminders({
  eventId,
  allDay,
  initial,
  save,
}: {
  eventId: string;
  allDay: boolean;
  initial: number[];
  save: (eventId: string, minutes: number[]) => Promise<{ error?: string }>;
}) {
  const t = useT();
  const [value, setValue] = useState(() => validFor(allDay, initial));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);

  async function change(next: number[]) {
    const before = value;
    setValue(next);
    setPending(true);
    setError(undefined);
    setSaved(false);
    let result: { error?: string };
    try {
      result = await save(eventId, next);
    } catch {
      result = { error: t("No se han podido guardar los avisos.") };
    }
    setPending(false);
    if (result.error) {
      setValue(before);
      setError(result.error);
    } else {
      setSaved(true);
    }
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-semibold text-ink">
        {t("Avisarme")}
      </legend>
      <ReminderList
        allDay={allDay}
        value={value}
        onChange={(next) => void change(next)}
        disabled={pending}
      />
      <FormAlert message={error} />
      {saved ? (
        <p role="status" className="text-sm text-ink">
          {t("Guardado.")}
        </p>
      ) : null}
    </fieldset>
  );
}
