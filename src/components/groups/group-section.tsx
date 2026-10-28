"use client";

import { useActionState, useId, useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/calendar/confirm-dialog";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { TextField } from "@/components/ui/text-field";
import type { GroupVisibility } from "@/lib/calendar/organize-groups";
import type { ConfirmState, FormState } from "@/lib/forms/form-state";

type GroupState = FormState<"name">;
type Result = { error?: string };

const VISIBILITY_TEXT: Record<GroupVisibility, string> = {
  shown: "Visible en el calendario",
  hidden: "Oculto en el calendario",
  partial: "Parcialmente visible: algunos calendarios están ocultos",
};

/**
 * One of the user's groups in "Mis calendarios": name, switch to show or hide
 * all its calendars, rename, delete and move (spec 007 RF-38 to RF-41).
 */
export function GroupSection({
  group,
  visibility,
  calendarCount,
  index,
  count,
  setVisibility,
  renameAction,
  deleteAction,
  onMove,
  children,
}: {
  group: { id: string; name: string };
  visibility: GroupVisibility;
  calendarCount: number;
  index: number;
  count: number;
  setVisibility: (visible: boolean) => Promise<Result>;
  renameAction: (prev: GroupState, formData: FormData) => Promise<GroupState>;
  deleteAction: () => Promise<ConfirmState>;
  onMove: (direction: "up" | "down") => void;
  children: React.ReactNode;
}) {
  const headingId = useId();
  const stateId = useId();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const [state, formAction, renaming] = useActionState(
    async (prev: GroupState, formData: FormData) => {
      const next = await renameAction(prev, formData);
      if (!next.formError && !next.fieldErrors) setEditing(false);
      return next;
    },
    { values: { name: group.name } },
  );
  const shown = visibility === "shown";

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2
          id={headingId}
          className="min-w-0 break-words text-lg font-semibold text-ink"
        >
          {group.name}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {calendarCount > 0 ? (
            <div className="flex min-h-11 items-center gap-2 text-sm font-medium text-ink">
              <label className="flex min-h-11 items-center">
                <input
                  type="checkbox"
                  checked={shown}
                  disabled={pending}
                  aria-describedby={stateId}
                  ref={(input) => {
                    if (input) input.indeterminate = visibility === "partial";
                  }}
                  onChange={() =>
                    startTransition(async () => {
                      // A partial group is shown whole (RF-39, RF-40).
                      setError((await setVisibility(!shown)).error);
                    })
                  }
                  className="size-5 shrink-0 accent-ink"
                />
                <span className="sr-only">
                  Mostrar «{group.name}» en el calendario
                </span>
              </label>
              <span id={stateId} className="text-muted">
                {VISIBILITY_TEXT[visibility]}
              </span>
            </div>
          ) : null}
          <Button
            variant="secondary"
            aria-label={`Renombrar ${group.name}`}
            onClick={() => setEditing(true)}
          >
            Renombrar
          </Button>
          <ConfirmDialog
            triggerLabel="Borrar"
            triggerAriaLabel={`Borrar ${group.name}`}
            title={`¿Borrar el grupo «${group.name}»?`}
            description="No se borra ningún calendario ni evento: sus calendarios quedarán sin grupo."
            confirmLabel="Sí, borrar"
            action={deleteAction}
          />
          <Button
            variant="secondary"
            aria-label={`Subir ${group.name}`}
            disabled={index === 0}
            onClick={() => onMove("up")}
            className="min-w-11 px-2"
          >
            <span aria-hidden="true">↑</span>
          </Button>
          <Button
            variant="secondary"
            aria-label={`Bajar ${group.name}`}
            disabled={index === count - 1}
            onClick={() => onMove("down")}
            className="min-w-11 px-2"
          >
            <span aria-hidden="true">↓</span>
          </Button>
        </div>
      </div>
      <FormAlert message={error} />
      {editing ? (
        <form
          action={formAction}
          noValidate
          className="flex flex-col gap-3 rounded-3xl bg-paper p-4 sm:flex-row sm:items-end"
        >
          <div className="flex-1 sm:max-w-sm">
            <FormAlert message={state.formError} />
            <TextField
              label={`Nuevo nombre de «${group.name}»`}
              name="name"
              maxLength={40}
              defaultValue={state.values.name}
              error={state.fieldErrors?.name}
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={renaming}>
              {renaming ? "Guardando…" : "Guardar nombre"}
            </Button>
            <Button variant="secondary" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      ) : null}
      {calendarCount === 0 ? (
        <p className="rounded-3xl bg-paper px-4 py-4 text-sm text-muted">
          Este grupo aún no tiene calendarios. Elige el grupo en la ficha de un
          calendario.
        </p>
      ) : (
        children
      )}
    </section>
  );
}
