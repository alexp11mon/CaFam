"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { SwapLabel } from "@/components/ui/swap-label";
import { TextField } from "@/components/ui/text-field";
import type { FormAction, ResendState } from "@/lib/auth/form-state";

// Spec 049, T2: the account waits for the link of its email (RF-1, RF-3).

export const RESEND_TEXTS = {
  sent: "Te hemos enviado otro enlace.",
  limited:
    "Ya te hemos enviado varios enlaces. Espera un poco antes de pedir otro.",
  expired: "El enlace no es válido o ha caducado. Pide uno nuevo.",
} as const;

const INITIAL: ResendState = {};

/**
 * "Reenviar el enlace": with `email` it sends to that address (the login);
 * without it, to the one of the sign-up kept on this device, or asks for it.
 */
export function ResendForm({
  action,
  email,
  askEmail = false,
  label = "Reenviar",
}: {
  action: FormAction<ResendState>;
  email?: string;
  askEmail?: boolean;
  label?: string;
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL);
  return (
    <form action={formAction} noValidate className="flex flex-col gap-3">
      {state.status ? (
        <p role="status" className="text-sm text-ink">
          {RESEND_TEXTS[state.status]}
        </p>
      ) : null}
      <FormAlert message={state.formError} />
      {askEmail ? (
        <TextField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
        />
      ) : email ? (
        <input type="hidden" name="email" value={email} />
      ) : null}
      <Button type="submit" variant="secondary" disabled={pending}>
        <SwapLabel busy={pending} idle={label} busyText="Enviando…" />
      </Button>
    </form>
  );
}

/** After signing up (RF-1), or when the link failed (RF-2). */
export function CheckEmail({
  email,
  expired = false,
  action,
}: {
  email: string | null;
  expired?: boolean;
  action: FormAction<ResendState>;
}) {
  return (
    <div className="flex flex-col gap-4">
      {expired ? (
        <FormAlert message={RESEND_TEXTS.expired} />
      ) : (
        <p className="text-ink">
          {email
            ? `Te hemos enviado un enlace a ${email}. Ábrelo para entrar.`
            : "Te hemos enviado un enlace por correo. Ábrelo para entrar."}
        </p>
      )}
      <ResendForm action={action} askEmail={expired && !email} />
      <Link
        href="/signup"
        className="min-h-11 self-center py-3 text-sm font-semibold text-accent-ink underline-offset-4 hover:underline"
      >
        Cambiar de email
      </Link>
    </div>
  );
}
