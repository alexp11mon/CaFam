"use client";

import { useActionState } from "react";
import { ConfirmDialog } from "@/components/calendar/confirm-dialog";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { Select } from "@/components/ui/select";
import { TextField } from "@/components/ui/text-field";
import type {
  ConfirmState,
  FormAction,
  FormState,
} from "@/lib/forms/form-state";
import type { AccessCodeRecord } from "@/lib/sharing/queries";
import { ROLE_LABELS } from "@/lib/sharing/roles";
import type { AccessCodeField } from "@/lib/sharing/schemas";

export type AccessCodeState = FormState<AccessCodeField>;

function CodeForm({
  action,
  initialRole,
  submitLabel,
  pendingLabel,
}: {
  action: FormAction<AccessCodeState>;
  initialRole: "editor" | "viewer";
  submitLabel: string;
  pendingLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {
    values: { role: initialRole, pin: "" },
  });
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      <FormAlert message={state.formError} />
      <Select
        label="Rol"
        name="role"
        defaultValue={state.values.role}
        error={errors.role}
      >
        <option value="viewer">{ROLE_LABELS.viewer}</option>
        <option value="editor">{ROLE_LABELS.editor}</option>
      </Select>
      {/* The PIN is never shown or kept: the form always comes back empty (RF-16). */}
      <TextField
        label="PIN"
        name="pin"
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={10}
        defaultValue=""
        error={errors.pin}
      />
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? pendingLabel : submitLabel}
        </Button>
      </div>
    </form>
  );
}

/** ID and PIN of a calendar: activate, change the PIN and disable (RF-14..RF-18). */
export function AccessCodePanel({
  code,
  saveAction,
  disableAction,
}: {
  code: AccessCodeRecord | null;
  saveAction: FormAction<AccessCodeState>;
  disableAction: FormAction<ConfirmState>;
}) {
  if (!code || !code.enabled) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-ink">
          {code
            ? `El código ${code.publicCode} está desactivado. Para activarlo de nuevo elige un PIN nuevo (de 6 a 10 dígitos).`
            : "Quien tenga el ID del calendario y el PIN podrá unirse sin enlace. Elige un PIN de 6 a 10 dígitos."}
        </p>
        <CodeForm
          action={saveAction}
          initialRole={code?.role ?? "viewer"}
          submitLabel="Activar código"
          pendingLabel="Activando…"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 rounded-lg bg-brand-soft/40 p-4 text-ink">
        <p className="text-sm">ID del calendario</p>
        <p className="font-mono text-2xl font-bold tracking-widest select-all">
          {code.publicCode}
        </p>
        <p className="text-sm">Rol de quien se une: {ROLE_LABELS[code.role]}</p>
        <p className="text-sm">
          El PIN no se puede consultar: nadie puede volver a verlo. Si lo
          olvidas, elige uno nuevo.
        </p>
      </div>
      <CodeForm
        action={saveAction}
        initialRole={code.role}
        submitLabel="Cambiar PIN"
        pendingLabel="Guardando…"
      />
      <div>
        <ConfirmDialog
          triggerLabel="Desactivar"
          title="¿Desactivar el ID y el PIN?"
          description="Nadie podrá unirse con ellos. Quienes ya se unieron mantienen su acceso. Para activarlo de nuevo tendrás que elegir un PIN nuevo."
          confirmLabel="Sí, desactivar"
          action={disableAction}
        />
      </div>
    </div>
  );
}
