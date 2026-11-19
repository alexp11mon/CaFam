"use client";

import { useActionState, useId, useState } from "react";
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

  // noValidate: errors come from the server in Spanish, not from the browser.
  return (
    <form action={formAction} noValidate className="flex flex-col gap-5">
      {state.result ? <ImportSummary result={state.result} /> : null}
      <FormAlert message={state.formError} />
      <TextField
        label="Enlace .ics"
        name="url"
        inputMode="url"
        autoComplete="off"
        spellCheck={false}
        defaultValue={state.values.url}
        error={errors.url}
      />
      <div className="flex flex-col gap-1">
        <label htmlFor={fileId} className="text-sm font-medium text-ink">
          Archivo .ics
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
          <legend className="mb-1 text-sm font-medium text-ink">Destino</legend>
          {(
            [
              ["new", "Un calendario nuevo"],
              ["existing", "Un calendario que ya tengo"],
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
          label="Calendario"
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
            label="Nombre del calendario (opcional)"
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
          Mantener actualizado desde este enlace
        </label>
        <p id={keepHintId} className="text-sm text-muted">
          Cada 6 horas se añaden, cambian y quitan los eventos que vienen del
          enlace. Lo que crees tú en el calendario no se toca.
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
            busyText="Importando…"
          />
        </Button>
        <LinkButton href="/dashboard/calendars" variant="secondary">
          Cancelar
        </LinkButton>
      </div>
    </form>
  );
}
