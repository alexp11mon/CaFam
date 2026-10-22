"use client";

import { useActionState, useId, useState } from "react";
import { ColorPicker } from "@/components/calendar/color-picker";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { LinkButton } from "@/components/ui/link-button";
import { TextField } from "@/components/ui/text-field";
import { DEFAULT_CALENDAR_COLOR } from "@/lib/calendar/palette";
import type { FormAction } from "@/lib/forms/form-state";
import { getImportErrorMessage } from "@/lib/ics/error-messages";
import { EMPTY_IMPORT_VALUES, type ImportState } from "@/lib/ics/import-state";
import { MAX_BYTES } from "@/lib/ics/limits";
import { ImportSummary } from "./import-summary";

const TOO_LARGE = getImportErrorMessage({ kind: "too-large" });

/** Import an .ics from a link or a file into a new calendar (RF-1, RF-2, RF-8, RF-10, RF-26, RF-32). */
export function ImportForm({ action }: { action: FormAction<ImportState> }) {
  const [state, formAction, pending] = useActionState(action, {
    values: EMPTY_IMPORT_VALUES,
  });
  const errors = state.fieldErrors ?? {};
  const fileId = useId();
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
          className="w-full rounded-xl border border-control bg-paper px-3 py-2 text-base text-ink file:mr-3 file:min-h-11 file:rounded-full file:border-0 file:bg-ink file:px-5 file:font-semibold file:text-white aria-invalid:border-danger"
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
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={pending || Boolean(fileError)}>
          {pending ? "Importando…" : "Importar calendario"}
        </Button>
        <LinkButton href="/dashboard/calendars" variant="secondary">
          Cancelar
        </LinkButton>
      </div>
    </form>
  );
}
