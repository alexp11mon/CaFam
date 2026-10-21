"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { LinkButton } from "@/components/ui/link-button";
import { TextArea } from "@/components/ui/text-area";
import { TextField } from "@/components/ui/text-field";
import type { CalendarField } from "@/lib/calendar/schemas";
import type { FormAction, FormState } from "@/lib/forms/form-state";
import { ColorPicker } from "./color-picker";

type CalendarFormState = FormState<CalendarField>;

/** Create / edit form of a calendar (RF-1..RF-4). */
export function CalendarForm({
  action,
  initial,
  submitLabel,
  pendingLabel,
}: {
  action: FormAction<CalendarFormState>;
  initial: CalendarFormState["values"];
  submitLabel: string;
  pendingLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {
    values: initial,
  });
  const errors = state.fieldErrors ?? {};

  // noValidate: errors come from the server in Spanish, not from the browser.
  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      <FormAlert message={state.formError} />
      <TextField
        label="Nombre"
        name="name"
        maxLength={50}
        defaultValue={state.values.name}
        error={errors.name}
      />
      <TextArea
        label="Descripción"
        name="description"
        maxLength={500}
        defaultValue={state.values.description}
        error={errors.description}
      />
      <ColorPicker
        name="color"
        defaultValue={state.values.color}
        error={errors.color}
      />
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? pendingLabel : submitLabel}
        </Button>
        <LinkButton href="/dashboard" variant="secondary">
          Cancelar
        </LinkButton>
      </div>
    </form>
  );
}
