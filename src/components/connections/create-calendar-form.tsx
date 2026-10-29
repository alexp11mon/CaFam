"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { TextField } from "@/components/ui/text-field";
import type { FormAction, FormState } from "@/lib/forms/form-state";

type CreateState = FormState<"name">;

/** Creates a calendar in the Google account and brings it (spec 009 RF-32). */
export function CreateCalendarForm({
  action,
}: {
  action: FormAction<CreateState>;
}) {
  const [state, formAction, pending] = useActionState(action, {
    values: { name: "" },
  });

  return (
    <form
      action={formAction}
      noValidate
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
    >
      <div className="flex-1 sm:max-w-sm">
        <FormAlert message={state.formError} />
        <TextField
          label="Nombre del calendario"
          name="name"
          maxLength={50}
          defaultValue={state.values.name}
          error={state.fieldErrors?.name}
        />
      </div>
      <div>
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Creando…" : "Crear en Google"}
        </Button>
      </div>
    </form>
  );
}
