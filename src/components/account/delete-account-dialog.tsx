"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/calendar/confirm-dialog";
import { TextField } from "@/components/ui/text-field";
import type { ConfirmState, FormAction } from "@/lib/forms/form-state";
import { forgetDevice } from "@/lib/offline/snapshot-store";

/**
 * Account deletion with a clear warning, the own email and the password (RF-16,
 * RF-17). The fields are controlled only to enable the button. An account
 * that only enters with Google confirms with its email (spec 050 RF-8).
 */
export function DeleteAccountDialog({
  action,
  needsPassword = true,
}: {
  action: FormAction<ConfirmState>;
  needsPassword?: boolean;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Nothing of the account stays on this device (spec 034 RF-65).
  const [deleting] = useState(
    () =>
      async (...args: Parameters<FormAction<ConfirmState>>) => {
        await forgetDevice().catch(() => {});
        return action(...args);
      },
  );

  return (
    <ConfirmDialog
      triggerLabel="Borrar mi cuenta"
      title="Borrar tu cuenta"
      description="Esta acción no se puede deshacer. Se borrarán tu cuenta y los calendarios que no compartes. Los que compartes quedarán 15 días sin propietario para que sus miembros decidan si los conservan."
      confirmLabel="Borrar definitivamente"
      action={deleting}
      confirmDisabled={!email.trim() || (needsPassword && !password)}
    >
      <TextField
        label="Tu email"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      {needsPassword ? (
        <TextField
          label="Tu contraseña"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      ) : null}
    </ConfirmDialog>
  );
}
