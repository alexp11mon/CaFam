"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { TextField } from "@/components/ui/text-field";
import type { FormAction, FormState } from "@/lib/forms/form-state";

type GroupState = FormState<"name">;

/** Creates one of the user's private groups (spec 007 RF-35). */
export function GroupForm({ action }: { action: FormAction<GroupState> }) {
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
          label="Nuevo grupo"
          name="name"
          maxLength={40}
          defaultValue={state.values.name}
          error={state.fieldErrors?.name}
        />
      </div>
      <div>
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Creando…" : "Crear grupo"}
        </Button>
      </div>
    </form>
  );
}
