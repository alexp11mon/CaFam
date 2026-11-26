"use client";

import { useActionState } from "react";
import { NextField } from "@/components/auth/next-field";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { TextField } from "@/components/ui/text-field";
import type {
  FormAction,
  ResendState,
  SignInState,
} from "@/lib/auth/form-state";
import { ResendForm } from "./check-email";
import { SwapLabel } from "@/components/ui/swap-label";
import { useT } from "@/components/i18n/locale-provider";

const INITIAL_STATE: SignInState = { values: { email: "" } };

export function LoginForm({
  action,
  resendAction,
}: {
  action: FormAction<SignInState>;
  /** "Reenviar el enlace" of an account still unconfirmed (spec 049 RF-3). */
  resendAction?: FormAction<ResendState>;
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);

  // noValidate: errors come from the server in Spanish, not from the browser (RNF-1).
  return (
    <>
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
          label={t("Contraseña")}
          name="password"
          type="password"
          autoComplete="current-password"
        />
        <NextField />
        <Button type="submit" disabled={pending}>
          <SwapLabel
            busy={pending}
            idle={t("Entrar")}
            busyText={t("Entrando…")}
          />
        </Button>
      </form>
      {state.unconfirmed && resendAction ? (
        <div className="mt-4">
          <ResendForm
            action={resendAction}
            email={state.values.email}
            label={t("Reenviar el enlace")}
          />
        </div>
      ) : null}
    </>
  );
}
