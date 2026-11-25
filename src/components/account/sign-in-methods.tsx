"use client";

import { useActionState } from "react";
import { GoogleLogo } from "@/components/brand/google-logo";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { SwapLabel } from "@/components/ui/swap-label";
import { TextField } from "@/components/ui/text-field";
import { maskEmail } from "@/lib/auth/pending";
import type { FormAction } from "@/lib/auth/form-state";

// Spec 050, T3: "Formas de entrar" (RF-5, RF-6).

interface IdentityState {
  formError?: string;
  saved?: string;
}

function Result({ state }: { state: IdentityState }) {
  return (
    <>
      <FormAlert message={state.formError} />
      {state.saved ? (
        <p role="status" className="text-sm text-ink">
          {state.saved}
        </p>
      ) : null}
    </>
  );
}

export function SignInMethods({
  hasPassword,
  googleEmail,
  linkAction,
  unlinkAction,
  createPasswordAction,
}: {
  hasPassword: boolean;
  /** The linked Google address, or null when Google is not linked. */
  googleEmail: string | null;
  linkAction: () => Promise<void>;
  unlinkAction: FormAction<IdentityState>;
  createPasswordAction: FormAction<IdentityState>;
}) {
  const [unlinked, unlink, unlinking] = useActionState(unlinkAction, {});
  const [created, create, creating] = useActionState(createPasswordAction, {});

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-2 text-ink">
        {hasPassword ? <li>Email y contraseña</li> : null}
        {googleEmail !== null ? (
          <li className="flex items-center gap-2">
            <GoogleLogo className="size-4" />
            Google{googleEmail ? ` (${maskEmail(googleEmail)})` : ""}
          </li>
        ) : null}
      </ul>

      {googleEmail === null ? (
        <form action={linkAction}>
          <Button type="submit" variant="secondary" className="gap-3">
            <GoogleLogo />
            Conectar Google
          </Button>
        </form>
      ) : hasPassword ? (
        <form action={unlink} className="flex flex-col gap-2">
          <Result state={unlinked} />
          <div>
            <Button type="submit" variant="secondary" disabled={unlinking}>
              <SwapLabel
                busy={unlinking}
                idle="Desconectar Google"
                busyText="Desconectando…"
              />
            </Button>
          </div>
        </form>
      ) : (
        <form action={create} noValidate className="flex flex-col gap-3">
          <p className="text-sm text-muted">
            Tu cuenta solo entra con Google. Crea una contraseña para poder
            entrar también con tu email (y desconectar Google si quieres).
          </p>
          <Result state={created} />
          <TextField
            label="Nueva contraseña"
            name="password"
            type="password"
            autoComplete="new-password"
            hint="Mínimo 8 caracteres"
          />
          <div>
            <Button type="submit" disabled={creating}>
              <SwapLabel
                busy={creating}
                idle="Crear contraseña"
                busyText="Creando…"
              />
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
