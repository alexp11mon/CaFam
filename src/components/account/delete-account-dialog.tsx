"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/calendar/confirm-dialog";
import { TextField } from "@/components/ui/text-field";
import type { ConfirmState, FormAction } from "@/lib/forms/form-state";

/**
 * Account deletion with a clear warning, the own email and the password (RF-16,
 * RF-17). The fields are controlled only to enable the button.
 */
export function DeleteAccountDialog({
  action,
}: {
  action: FormAction<ConfirmState>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <ConfirmDialog
      triggerLabel="Borrar mi cuenta"
      title="Borrar tu cuenta"
      description="Esta acción no se puede deshacer. Se borrarán tu cuenta y los calendarios que no compartes. Los que compartes quedarán 15 días sin propietario para que sus miembros decidan si los conservan."
      confirmLabel="Borrar definitivamente"
      action={action}
      confirmDisabled={!email.trim() || !password}
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
      <TextField
        label="Tu contraseña"
        name="password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
    </ConfirmDialog>
  );
}
