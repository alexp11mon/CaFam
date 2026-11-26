"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FormAlert } from "@/components/ui/form-alert";
import { useT } from "@/components/i18n/locale-provider";
import { CALENDAR_MESSAGES } from "@/lib/calendar/error-messages";
import type { Locale } from "@/lib/i18n/locale";

type Result = { error?: string };

// Each language is written in itself, so anyone finds theirs (spec 053 RF-1).
const OPTIONS: { id: Locale; label: string; lang: Locale }[] = [
  { id: "es", label: "Español", lang: "es" },
  { id: "en", label: "English", lang: "en" },
];

/** Idioma: saved in the profile and the cookie, then the frame paints again. */
export function LocalePicker({
  current,
  setLocale,
}: {
  current: Locale;
  setLocale: (locale: Locale) => Promise<Result>;
}) {
  const t = useT();
  const router = useRouter();
  const [selected, setSelected] = useState(current);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function choose(locale: Locale) {
    const previous = selected;
    setSelected(locale);
    setError(undefined);
    startTransition(async () => {
      let result: Result;
      try {
        result = await setLocale(locale);
      } catch {
        result = { error: CALENDAR_MESSAGES.connection };
      }
      if (result.error) {
        setSelected(previous);
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <fieldset className="flex flex-col gap-4" aria-busy={pending}>
      <legend className="mb-1 text-lg font-semibold text-ink">
        {t("Idioma")}
      </legend>
      <div
        role="radiogroup"
        aria-label={t("Idioma")}
        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
      >
        {OPTIONS.map((option) => (
          <label
            key={option.id}
            lang={option.lang}
            className="press flex min-h-14 cursor-pointer items-center gap-3 rounded-control border border-line bg-paper px-4 py-3 text-base font-medium text-ink has-checked:border-ink has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink"
          >
            <input
              type="radio"
              name="locale"
              value={option.id}
              checked={selected === option.id}
              onChange={() => choose(option.id)}
              className="accent-current"
            />
            {option.label}
          </label>
        ))}
      </div>
      <FormAlert message={error && t(error)} />
    </fieldset>
  );
}
