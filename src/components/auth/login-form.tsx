"use client";

import { useActionState } from "react";
import { NextField } from "@/components/auth/next-field";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { TextField } from "@/components/ui/text-field";
import type { FormAction, SignInState } from "@/lib/auth/form-state";

const INITIAL_STATE: SignInState = { values: { email: "" } };

export function LoginForm({ action }: { action: FormAction<SignInState> }) {
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);

  // noValidate: errors come from the server in Spanish, not from the browser (RNF-1).
  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      <FormAlert message={state.formError} />
      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        defaultValue={state.values.email}
      />
      <TextField
        label="Contraseña"
        name="password"
        type="password"
        autoComplete="current-password"
      />
      <NextField />
      <Button type="submit" disabled={pending}>
        {pending ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
