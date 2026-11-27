"use client";

import { useState } from "react";
import { useT } from "@/components/i18n/locale-provider";
import { FormAlert } from "@/components/ui/form-alert";
import { Select } from "@/components/ui/select";
import { CALENDAR_MESSAGES } from "@/lib/calendar/error-messages";
import { isHome, type Home } from "@/lib/now/home";

type Result = { error?: string };

const OPTIONS: { id: Home; label: string }[] = [
  { id: "calendar", label: "Calendario" },
  { id: "now", label: "Ahora" },
];

/**
 * "Pantalla de inicio" (spec 054 RF-24, RF-26): saved at once in the account
 * and undone if saving fails, like the other options.
 */
export function HomeSetting({
  current,
  save,
}: {
  current: Home;
  save: (home: Home) => Promise<Result>;
}) {
  const t = useT();
  const [home, setHome] = useState(current);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);

  async function choose(next: Home) {
    const previous = home;
    setHome(next);
    setError(undefined);
    setSaved(false);
    let result: Result;
    try {
      result = await save(next);
    } catch {
      result = { error: CALENDAR_MESSAGES.connection };
    }
    if (result.error) {
      setHome(previous);
      setError(result.error);
      return;
    }
    setSaved(true);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="sm:max-w-60">
        <Select
          label={t("Pantalla de inicio")}
          name="home"
          value={home}
          onChange={(event) => {
            if (isHome(event.target.value)) void choose(event.target.value);
          }}
        >
          {OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {t(option.label)}
            </option>
          ))}
        </Select>
      </div>
      <FormAlert message={error && t(error)} />
      {saved ? (
        <p role="status" className="text-sm text-ink">
          {t("Guardado.")}
        </p>
      ) : null}
    </div>
  );
}
