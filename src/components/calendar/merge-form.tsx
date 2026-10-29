"use client";

import { useActionState, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { LinkButton } from "@/components/ui/link-button";
import { Select } from "@/components/ui/select";
import { TextField } from "@/components/ui/text-field";
import type { MergeField } from "@/lib/calendar/schemas";
import type { FormAction, FormState } from "@/lib/forms/form-state";
import { getMergeAccess, type MergeMember } from "@/lib/sharing/merge-access";
import { ColorPicker } from "./color-picker";

type MergeFormState = FormState<MergeField>;
export type MergeFormValues = MergeFormState["values"];

export interface MergeCalendar {
  id: string;
  name: string;
  color: string;
  eventCount: number;
}

const splitIds = (ids: string) => (ids ? ids.split(",") : []);

function listNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} y ${names.at(-1)}`;
}

function eventsLabel(count: number): string {
  return count === 1 ? "1 evento" : `${count} eventos`;
}

/**
 * Merge several owned calendars into one of them or into a new one (RF-49..RF-52).
 * A confirmation lists what disappears and how many events move before anything runs.
 */
export function MergeForm({
  action,
  calendars,
  initial,
  members = [],
}: {
  action: FormAction<MergeFormState>;
  /** Only calendars the user owns. */
  calendars: MergeCalendar[];
  initial: MergeFormValues;
  /** Members of the owned calendars, to warn who is affected (RF-36, RF-37). */
  members?: MergeMember[];
}) {
  const [state, formAction, pending] = useActionState(action, {
    values: initial,
  });
  const errors = state.fieldErrors ?? {};
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  // The fields are uncontrolled (React resets forms after an action); this state only
  // drives the result options and the summary. A server response carries what was
  // submitted: adopt it (React "adjust state on render").
  const [selected, setSelected] = useState(splitIds(initial.sourceIds));
  const [target, setTarget] = useState(initial.targetId);
  const [newName, setNewName] = useState(initial.newName);
  const [seen, setSeen] = useState(state);
  if (seen !== state) {
    setSeen(state);
    setSelected(splitIds(state.values.sourceIds));
    setTarget(state.values.targetId);
    setNewName(state.values.newName);
  }

  const chosen = calendars.filter((calendar) => selected.includes(calendar.id));
  // The result must be one of the chosen calendars; otherwise it is a new one.
  const targetId = chosen.some((calendar) => calendar.id === target)
    ? target
    : "";
  const disappearing = chosen.filter((calendar) => calendar.id !== targetId);
  const moved = disappearing.reduce((sum, c) => sum + c.eventCount, 0);
  const targetName = targetId
    ? (chosen.find((calendar) => calendar.id === targetId)?.name ?? "")
    : newName.trim() || "el calendario nuevo";
  const canContinue = chosen.length >= 2;
  const access = getMergeAccess({
    sourceIds: chosen.map((calendar) => calendar.id),
    targetId: targetId || null,
    members,
  });

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  function openConfirmation() {
    if (canContinue && !pending) dialog.current?.showModal();
  }

  // Enter in a text field must ask for confirmation, not submit straight away.
  function guardImplicitSubmit(event: React.KeyboardEvent<HTMLFormElement>) {
    const field = event.target as HTMLElement;
    if (event.key === "Enter" && field.tagName === "INPUT") {
      event.preventDefault();
      openConfirmation();
    }
  }

  const sourceError =
    errors.sourceIds ??
    (canContinue ? undefined : "Elige al menos dos calendarios.");

  return (
    <form
      action={formAction}
      noValidate
      onKeyDown={guardImplicitSubmit}
      className="flex flex-col gap-5"
    >
      <FormAlert message={state.formError} />
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-sm font-medium text-ink">
          Calendarios a juntar
        </legend>
        {calendars.map((calendar) => (
          <label
            key={calendar.id}
            className="flex min-h-11 items-center gap-3 text-ink"
          >
            <input
              type="checkbox"
              name="sourceIds"
              value={calendar.id}
              defaultChecked={splitIds(state.values.sourceIds).includes(
                calendar.id,
              )}
              onChange={() => toggle(calendar.id)}
              className="size-5 shrink-0 accent-ink"
            />
            <span
              aria-hidden="true"
              className="size-3 shrink-0 rounded-full ring-1 ring-pastel-ink/20"
              style={{ backgroundColor: calendar.color }}
            />
            <span className="min-w-0 break-words">
              {calendar.name} · {eventsLabel(calendar.eventCount)}
            </span>
          </label>
        ))}
        {sourceError ? (
          <p aria-live="polite" className="text-sm text-danger">
            {sourceError}
          </p>
        ) : null}
      </fieldset>

      <Select
        label="Resultado"
        name="targetId"
        // Remounted when the choice changes so the options match the chosen calendars.
        key={chosen.map((calendar) => calendar.id).join(",")}
        defaultValue={targetId}
        onChange={(event) => setTarget(event.target.value)}
        error={errors.targetId}
      >
        <option value="">Un calendario nuevo</option>
        {chosen.map((calendar) => (
          <option key={calendar.id} value={calendar.id}>
            {calendar.name}
          </option>
        ))}
      </Select>

      {targetId === "" ? (
        <>
          <TextField
            label="Nombre del calendario nuevo"
            name="newName"
            maxLength={50}
            defaultValue={state.values.newName}
            onChange={(event) => setNewName(event.target.value)}
            error={errors.newName}
          />
          <ColorPicker
            name="newColor"
            defaultValue={state.values.newColor}
            error={errors.newColor}
          />
        </>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button disabled={!canContinue || pending} onClick={openConfirmation}>
          {pending ? "Juntando…" : "Juntar calendarios"}
        </Button>
        <LinkButton href="/dashboard/calendars" variant="secondary">
          Cancelar
        </LinkButton>
      </div>

      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl glass-float p-6 text-ink backdrop:bg-scrim/50"
      >
        <div className="flex flex-col gap-4">
          <h2 id={titleId} className="text-lg font-bold">
            {`¿Juntar en «${targetName}»?`}
          </h2>
          <p>Desaparecerán: {listNames(disappearing.map((c) => c.name))}.</p>
          <p>
            {moved === 0
              ? "No hay eventos que mover."
              : `${moved === 1 ? "Se moverá" : "Se moverán"} ${eventsLabel(moved)} a «${targetName}».`}
          </p>
          {access.losing.length > 0 ? (
            <p>Perderán el acceso: {listNames(access.losing)}.</p>
          ) : null}
          {access.gaining.length > 0 ? (
            <p>
              Pasarán a ver los eventos de los otros calendarios:{" "}
              {listNames(access.gaining)}.
            </p>
          ) : null}
          <p className="font-semibold">No se puede deshacer.</p>
          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="secondary" onClick={() => dialog.current?.close()}>
              Cancelar
            </Button>
            <Button type="submit" variant="danger" disabled={pending}>
              Sí, juntar
            </Button>
          </div>
        </div>
      </dialog>
    </form>
  );
}
