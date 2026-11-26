"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { TextField } from "@/components/ui/text-field";
import type { FormAction, FormState } from "@/lib/forms/form-state";
import { SwapLabel } from "@/components/ui/swap-label";
import { useT } from "@/components/i18n/locale-provider";

type GroupState = FormState<"name">;

const INITIAL: GroupState = { values: { name: "" } };

/** Creates one of the user's private groups (spec 007 RF-35). */
export function GroupForm({
  action,
  onCreated,
}: {
  action: FormAction<GroupState>;
  /** The group was created: the sheet that holds the form closes (spec 032 RF-13). */
  onCreated?: () => void;
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState(action, INITIAL);

  // Each result once: Activity runs the effects again (AGENTS trap).
  const handled = useRef<GroupState>(INITIAL);
  useEffect(() => {
    if (handled.current === state) return;
    handled.current = state;
    if (!state.formError && !state.fieldErrors) onCreated?.();
  }, [state, onCreated]);

  return (
    <form
      action={formAction}
      noValidate
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
    >
      <div className="flex-1 sm:max-w-sm">
        <FormAlert message={state.formError} />
        <TextField
          label={t("Nombre del grupo")}
          name="name"
          maxLength={40}
          defaultValue={state.values.name}
          error={state.fieldErrors?.name}
          hint={t("Junta calendarios para mostrarlos u ocultarlos a la vez.")}
        />
      </div>
      <div>
        <Button type="submit" variant="secondary" disabled={pending}>
          <SwapLabel
            busy={pending}
            idle="Crear grupo"
            busyText={t("Creando…")}
          />
        </Button>
      </div>
    </form>
  );
}
