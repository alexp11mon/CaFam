"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { TextField } from "@/components/ui/text-field";
import type { ForgotPasswordState } from "@/lib/account/form-state";
import type { FormAction } from "@/lib/auth/form-state";

const INITIAL_STATE: ForgotPasswordState = { values: { email: "" } };
const SENT_MESSAGE =
  "Si la dirección existe, te hemos enviado un correo con el enlace.";
const EXPIRED_MESSAGE = "El enlace no es válido o ha caducado. Pide uno nuevo.";

/** Asks for the address; the answer never says whether the account exists (RF-1). */
export function ForgotPasswordForm({
  action,
  expired = false,
}: {
  action: FormAction<ForgotPasswordState>;
  expired?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);

  if (state.sent) {
    return (
      <p role="status" className="text-ink">
        {SENT_MESSAGE}
      </p>
    );
  }

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      <FormAlert
        message={state.formError ?? (expired ? EXPIRED_MESSAGE : undefined)}
      />
      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        defaultValue={state.values.email}
        error={state.fieldErrors?.email}
      />
      <Button type="submit" disabled={pending}>
        {pending ? "Enviando…" : "Enviar enlace"}
      </Button>
    </form>
  );
}
