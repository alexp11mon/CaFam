"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { Select } from "@/components/ui/select";
import { TextField } from "@/components/ui/text-field";
import type { ProfileState } from "@/lib/account/form-state";
import type { FormAction } from "@/lib/auth/form-state";

/** Name and time zone of the own profile (spec 006, RF-13 to RF-15). */
export function ProfileForm({
  action,
  initial,
  timeZones,
}: {
  action: FormAction<ProfileState>;
  initial: { displayName: string; timeZone: string };
  timeZones: readonly string[];
}) {
  const [state, formAction, pending] = useActionState(action, {
    values: initial,
  });
  // The saved zone must stay selectable even if this browser does not list it.
  const zones = timeZones.includes(state.values.timeZone)
    ? timeZones
    : [state.values.timeZone, ...timeZones];

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      <FormAlert message={state.formError} />
      {state.saved ? (
        <p role="status" className="text-sm text-ink">
          Perfil guardado.
        </p>
      ) : null}
      <TextField
        label="Nombre"
        name="displayName"
        autoComplete="name"
        maxLength={50}
        defaultValue={state.values.displayName}
        error={state.fieldErrors?.displayName}
      />
      <Select
        label="Zona horaria"
        name="timeZone"
        defaultValue={state.values.timeZone}
        error={state.fieldErrors?.timeZone}
      >
        {zones.map((zone) => (
          <option key={zone} value={zone}>
            {zone}
          </option>
        ))}
      </Select>
      <Button type="submit" disabled={pending}>
        {pending ? "Guardando…" : "Guardar perfil"}
      </Button>
    </form>
  );
}
