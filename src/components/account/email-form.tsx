"use client";

import { useActionState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { TextField } from "@/components/ui/text-field";
import type { EmailChangeState } from "@/lib/account/form-state";
import type { FormAction } from "@/lib/auth/form-state";
import { SwapLabel } from "@/components/ui/swap-label";
import { usePulseOn } from "@/lib/hooks/use-pulse-on";
import { useT } from "@/components/i18n/locale-provider";

const INITIAL_STATE: EmailChangeState = { values: { newEmail: "" } };

/** Asks for an email change; the old address works until the new one confirms (RF-6, RF-10). */
export function EmailForm({
  action,
  email,
  pendingEmail,
}: {
  action: FormAction<EmailChangeState>;
  email: string;
  pendingEmail: string | null;
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);
  const waiting = state.pendingEmail ?? pendingEmail;
  const button = useRef<HTMLButtonElement>(null);
  usePulseOn(button, state.pendingEmail ? state : null);

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        {t("Email actual:")}{" "}
        <span className="font-medium text-ink">{email}</span>
      </p>
      {waiting ? (
        <p role="status" className="text-sm text-ink">
          {t(
            "Cambio pendiente de confirmar: {waiting}. Abre el correo que te hemos enviado a esa dirección y pulsa el enlace.",
            { waiting },
          )}
        </p>
      ) : null}
      <FormAlert message={state.formError} />
      <TextField
        label={t("Nuevo email")}
        name="newEmail"
        type="email"
        autoComplete="email"
        inputMode="email"
        defaultValue={state.values.newEmail}
        error={state.fieldErrors?.newEmail}
      />
      <TextField
        label={t("Contraseña actual")}
        name="currentPassword"
        type="password"
        autoComplete="current-password"
        error={state.fieldErrors?.currentPassword}
      />
      <Button
        ref={button}
        type="submit"
        disabled={pending}
        className="self-start"
      >
        <SwapLabel
          busy={pending}
          idle="Cambiar email"
          busyText={t("Enviando…")}
        />
      </Button>
    </form>
  );
}
