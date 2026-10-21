"use client";

import { useActionState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { TextField } from "@/components/ui/text-field";
import type { FormAction, SignUpState } from "@/lib/auth/form-state";

const INITIAL_STATE: SignUpState = { values: { displayName: "", email: "" } };

const subscribeNoop = () => () => {};

function detectTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
}

/** Browser time zone, empty during server rendering (RF-26). */
function useBrowserTimeZone(): string {
  return useSyncExternalStore(subscribeNoop, detectTimeZone, () => "");
}

export function SignupForm({ action }: { action: FormAction<SignUpState> }) {
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);
  const timeZone = useBrowserTimeZone();
  const errors = state.fieldErrors ?? {};

  // noValidate: errors come from the server in Spanish, not from the browser (RNF-1).
  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      <FormAlert message={state.formError} />
      <TextField
        label="Nombre visible"
        name="displayName"
        autoComplete="name"
        maxLength={50}
        defaultValue={state.values.displayName}
        error={errors.displayName}
      />
      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        defaultValue={state.values.email}
        error={errors.email}
      />
      <TextField
        label="Contraseña"
        name="password"
        type="password"
        autoComplete="new-password"
        error={errors.password}
      />
      <input type="hidden" name="timeZone" value={timeZone} />
      <Button type="submit" disabled={pending}>
        {pending ? "Creando cuenta…" : "Crear cuenta"}
      </Button>
    </form>
  );
}
