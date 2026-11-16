"use client";

import { useActionState } from "react";
import type { NewNoteState } from "@/app/dashboard/notes/actions";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { Select } from "@/components/ui/select";
import { SwapLabel } from "@/components/ui/swap-label";
import { TextField } from "@/components/ui/text-field";
import { NOTE_TITLE_MAX } from "@/lib/notes/limits";

const KINDS = [
  {
    id: "list",
    label: "Lista de tareas",
    hint: "Elementos con casilla para ir tachando.",
  },
  { id: "text", label: "Nota de texto", hint: "Texto libre." },
];

/**
 * A new note in one screen (spec 028 RF-4): what kind, an optional title and
 * where it lives. Personal unless a calendar is chosen.
 */
export function NoteForm({
  action,
  calendars,
}: {
  action: (state: NewNoteState, data: FormData) => Promise<NewNoteState>;
  /** Calendars where the user can write: a note there is shared with them. */
  calendars: readonly { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const values = state.values;

  return (
    <form action={formAction} noValidate className="flex flex-col gap-5">
      <FormAlert message={state.error} />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium text-ink">Tipo</legend>
        {KINDS.map((kind) => (
          <label
            key={kind.id}
            className="flex min-h-14 cursor-pointer items-center gap-3 rounded-control border border-control bg-paper px-4 py-2 has-checked:border-ink has-checked:ring-2 has-checked:ring-ink/20 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink"
          >
            <input
              type="radio"
              name="kind"
              value={kind.id}
              defaultChecked={(values?.kind ?? "list") === kind.id}
              className="size-5 accent-ink"
            />
            <span className="flex flex-col">
              <span className="font-semibold text-ink">{kind.label}</span>
              <span className="text-sm text-muted">{kind.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <TextField
        label="Título (opcional)"
        name="title"
        maxLength={NOTE_TITLE_MAX}
        defaultValue={values?.title ?? ""}
        autoComplete="off"
        data-autofocus=""
      />
      <Select
        label="Dónde se guarda"
        name="calendarId"
        defaultValue={values?.calendarId ?? ""}
      >
        <option value="">Personal (solo tú la ves)</option>
        {calendars.map((calendar) => (
          <option key={calendar.id} value={calendar.id}>
            Compartida en {calendar.name}
          </option>
        ))}
      </Select>
      <Button type="submit" disabled={pending} className="self-start">
        <SwapLabel busy={pending} idle="Crear nota" busyText="Creando…" />
      </Button>
    </form>
  );
}
