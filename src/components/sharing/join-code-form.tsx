"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { TextField } from "@/components/ui/text-field";
import type { FormAction, FormState } from "@/lib/forms/form-state";
import type { JoinCodeField } from "@/lib/sharing/schemas";

export type JoinCodeState = FormState<JoinCodeField>;

const INITIAL_STATE: JoinCodeState = { values: { code: "", pin: "" } };

/** Join a calendar with its ID and PIN (RF-19..RF-22). */
export function JoinCodeForm({
  action,
}: {
  action: FormAction<JoinCodeState>;
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);
  const errors = state.fieldErrors ?? {};

  // noValidate: errors come from the server in Spanish, not from the browser.
  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      <FormAlert message={state.formError} />
      <TextField
        label="ID del calendario"
        name="code"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={32}
        defaultValue={state.values.code}
        error={errors.code}
      />
      {/* The PIN is never kept after a failed attempt. */}
      <TextField
        label="PIN"
        name="pin"
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={32}
        defaultValue=""
        error={errors.pin}
      />
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Uniéndote…" : "Unirme"}
        </Button>
      </div>
    </form>
  );
}
