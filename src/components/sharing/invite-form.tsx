"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { Select } from "@/components/ui/select";
import { TextField } from "@/components/ui/text-field";
import type { FormAction, FormState } from "@/lib/forms/form-state";
import type { InviteField } from "@/lib/sharing/schemas";
import { ROLE_LABELS } from "@/lib/sharing/roles";
import { CopyButton } from "./copy-button";

export type InviteState = FormState<InviteField> & {
  /** Only lives in the state of the submit that created it: the token is never stored (RF-1). */
  inviteUrl?: string;
};

const INITIAL_STATE: InviteState = { values: { role: "viewer", maxUses: "1" } };

/** Creates an invite link and shows it once (RF-1..RF-3). */
export function InviteForm({ action }: { action: FormAction<InviteState> }) {
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      <FormAlert message={state.formError} />
      <Select
        label="Rol"
        name="role"
        defaultValue={state.values.role}
        error={errors.role}
      >
        <option value="viewer">{ROLE_LABELS.viewer}</option>
        <option value="editor">{ROLE_LABELS.editor}</option>
      </Select>
      <TextField
        label="Usos máximos"
        name="maxUses"
        inputMode="numeric"
        autoComplete="off"
        defaultValue={state.values.maxUses}
        error={errors.maxUses}
      />
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Creando…" : "Crear invitación"}
        </Button>
      </div>
      {state.inviteUrl ? (
        <div className="flex flex-col gap-3 rounded-3xl bg-paper p-4">
          <p className="text-sm font-medium text-ink">
            Enlace de invitación. Solo se muestra ahora: cópialo antes de salir
            de esta página.
          </p>
          <p className="text-sm font-medium break-all text-ink select-all">
            {state.inviteUrl}
          </p>
          <CopyButton text={state.inviteUrl} />
        </div>
      ) : null}
    </form>
  );
}
