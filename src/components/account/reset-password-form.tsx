"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { TextField } from "@/components/ui/text-field";
import type { ResetPasswordState } from "@/lib/account/form-state";
import type { FormAction } from "@/lib/auth/form-state";

const INITIAL_STATE: ResetPasswordState = {};

/** Sets the new password from the recovery session (spec 006, RF-2). */
export function ResetPasswordForm({
  action,
}: {
  action: FormAction<ResetPasswordState>;
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      <FormAlert message={state.formError} />
      <TextField
        label="Nueva contraseña"
        name="password"
        type="password"
        autoComplete="new-password"
        error={state.fieldErrors?.password}
      />
      <Button type="submit" disabled={pending}>
        {pending ? "Guardando…" : "Guardar contraseña"}
      </Button>
    </form>
  );
}
