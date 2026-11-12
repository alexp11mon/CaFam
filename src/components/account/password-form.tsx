"use client";

import { useActionState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { TextField } from "@/components/ui/text-field";
import type { PasswordChangeState } from "@/lib/account/form-state";
import type { FormAction } from "@/lib/auth/form-state";
import { SwapLabel } from "@/components/ui/swap-label";
import { usePulseOn } from "@/lib/hooks/use-pulse-on";

const INITIAL_STATE: PasswordChangeState = {};

/** Changes the password from Ajustes (spec 006, RF-30 to RF-33). */
export function PasswordForm({
  action,
}: {
  action: FormAction<PasswordChangeState>;
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);
  const button = useRef<HTMLButtonElement>(null);
  usePulseOn(button, state.saved && state);

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      <FormAlert message={state.formError} />
      {state.saved ? (
        <p role="status" className="text-sm text-ink">
          Contraseña cambiada. Se han cerrado tus otras sesiones.
        </p>
      ) : null}
      <TextField
        label="Contraseña actual"
        name="currentPassword"
        type="password"
        autoComplete="current-password"
        error={state.fieldErrors?.currentPassword}
      />
      <TextField
        label="Nueva contraseña"
        name="newPassword"
        type="password"
        autoComplete="new-password"
        hint="Mínimo 8 caracteres"
        error={state.fieldErrors?.newPassword}
      />
      <Button
        ref={button}
        type="submit"
        disabled={pending}
        className="self-start"
      >
        <SwapLabel
          busy={pending}
          idle="Cambiar contraseña"
          busyText="Guardando…"
        />
      </Button>
    </form>
  );
}
