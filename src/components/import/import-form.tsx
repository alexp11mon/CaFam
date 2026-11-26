"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { ColorPicker } from "@/components/calendar/color-picker";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { LinkButton } from "@/components/ui/link-button";
import { Select } from "@/components/ui/select";
import { TextField } from "@/components/ui/text-field";
import { DEFAULT_CALENDAR_COLOR } from "@/lib/calendar/palette";
import type { FormAction } from "@/lib/forms/form-state";
import { getImportErrorMessage } from "@/lib/ics/error-messages";
import { EMPTY_IMPORT_VALUES, type ImportState } from "@/lib/ics/import-state";
import { MAX_BYTES } from "@/lib/ics/limits";
import { ImportSummary } from "./import-summary";
import { SwapLabel } from "@/components/ui/swap-label";
import {
  dropShared,
  icsOf,
  readShared,
  sharedIdFromLocation,
} from "@/lib/share/inbox";
import { useT } from "@/components/i18n/locale-provider";

const TOO_LARGE = getImportErrorMessage({ kind: "too-large" });

export interface ImportDestination {
  id: string;
  name: string;
}

/**
 * Import an .ics from a link or a file into a new calendar (RF-1, RF-2, RF-8,
 * RF-10, RF-26, RF-32) or into one the user can write (spec 044 RF-1).
 */
export function ImportForm({
  action,
  destinations = [],
}: {
  action: FormAction<ImportState>;
  /** Normal calendars where the user is owner or editor. */
  destinations?: ImportDestination[];
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState(action, {
    values: EMPTY_IMPORT_VALUES,
  });
  const [destination, setDestination] = useState(
    state.values.destination || "new",
  );
  const existing = destination === "existing" && destinations.length > 0;
  const errors = state.fieldErrors ?? {};
  const fileId = useId();
  const keepHintId = useId();
  const fileErrorId = `${fileId}-error`;
  // The server decides, but a file over the limit is announced before it is sent (RF-26).
  const [fileError, setFileError] = useState<string>();

  // An .ics shared from another app, read from the device (spec 047 RF-6):
  // it goes with the form only when the person presses "Importar".
  const [shared, setShared] = useState<{ id: string; file: File } | null>(null);
  useEffect(() => {
    const id = sharedIdFromLocation();
    if (!id) return;
    let live = true;
    void readShared(id).then((item) => {
      const file = item && icsOf(item);
      if (live && file) setShared({ id, file });
    });
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    if (state.result && shared) void dropShared(shared.id);
  }, [state.result, shared]);

  function send(formData: FormData) {
    const file = formData.get("file");
    if (shared && !(file instanceof File && file.size > 0))
      formData.set("file", shared.file);
    formAction(formData);
  }

  // noValidate: errors come from the server in Spanish, not from the browser.
  return (
    <form action={send} noValidate className="flex flex-col gap-5">
      {state.result ? <ImportSummary result={state.result} /> : null}
      <FormAlert message={state.formError} />
      <TextField
        label={t("Enlace .ics")}
        name="url"
        inputMode="url"
        autoComplete="off"
        spellCheck={false}
        defaultValue={state.values.url}
        error={errors.url}
      />
      <div className="flex flex-col gap-1">
        <label htmlFor={fileId} className="text-sm font-medium text-ink">
          {t("Archivo .ics")}
        </label>
        <input
          id={fileId}
          name="file"
          type="file"
          accept=".ics,text/calendar"
          aria-invalid={Boolean(fileError)}
          aria-describedby={fileError ? fileErrorId : undefined}
          onChange={(event) => {
            const file = event.target.files?.[0];
            setFileError(file && file.size > MAX_BYTES ? TOO_LARGE : undefined);
          }}
          className="w-full rounded-control border border-control bg-paper px-3 py-2 text-base text-ink file:mr-3 file:min-h-11 file:rounded-control file:border-0 file:bg-stone file:px-5 file:font-semibold file:text-ink aria-invalid:border-danger"
        />
        {shared ? (
          <p className="text-sm text-ink">
            {t("Archivo compartido: {name}", { name: shared.file.name })}
          </p>
        ) : null}
        {fileError ? (
          <p
            id={fileErrorId}
            aria-live="polite"
            className="text-sm text-danger"
          >
            {fileError}
          </p>
        ) : null}
      </div>
      {destinations.length > 0 ? (
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 text-sm font-medium text-ink">
            {t("Destino")}
          </legend>
          {(
            [
              ["new", t("Un calendario nuevo")],
              ["existing", t("Un calendario que ya tengo")],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="flex min-h-11 items-center gap-3">
              <input
                type="radio"
                name="destination"
                value={value}
                checked={destination === value}
                onChange={() => setDestination(value)}
                className="size-5 shrink-0 accent-ink"
              />
              {label}
            </label>
          ))}
        </fieldset>
      ) : null}
      {existing ? (
        <Select
          label={t("Calendario")}
          name="calendar"
          defaultValue={state.values.calendar || destinations[0]?.id}
          error={errors.calendar}
        >
          {destinations.map((calendar) => (
            <option key={calendar.id} value={calendar.id}>
              {calendar.name}
            </option>
          ))}
        </Select>
      ) : (
        <>
          <TextField
            label={t("Nombre del calendario (opcional)")}
            name="name"
            maxLength={50}
            defaultValue={state.values.name}
            error={errors.name}
          />
          <ColorPicker
            name="color"
            defaultValue={state.values.color || DEFAULT_CALENDAR_COLOR}
            error={errors.color}
          />
        </>
      )}
      <div className="flex flex-col gap-1">
        <label className="flex min-h-11 items-center gap-3 text-ink">
          <input
            type="checkbox"
            name="keep"
            aria-describedby={keepHintId}
            aria-invalid={Boolean(errors.keep)}
            className="size-5 shrink-0 accent-ink"
          />
          {t("Mantener actualizado desde este enlace")}
        </label>
        <p id={keepHintId} className="text-sm text-muted">
          {t(
            "Cada 6 horas se añaden, cambian y quitan los eventos que vienen del enlace. Lo que crees tú en el calendario no se toca.",
          )}
        </p>
        {errors.keep ? (
          <p role="alert" className="text-sm text-danger">
            {errors.keep}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={pending || Boolean(fileError)}>
          <SwapLabel
            busy={pending}
            idle="Importar calendario"
            busyText={t("Importando…")}
          />
        </Button>
        <LinkButton href="/dashboard/calendars" variant="secondary">
          {t("Cancelar")}
        </LinkButton>
      </div>
    </form>
  );
}
