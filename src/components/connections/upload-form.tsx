"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { Select } from "@/components/ui/select";
import type { FormAction, FormState } from "@/lib/forms/form-state";

type UploadState = FormState<"connectionId">;

const count = (n: number) => `${n} ${n === 1 ? "evento" : "eventos"}`;

/**
 * Chooses the Google account and says what will be copied before uploading
 * (spec 009 RF-34, RF-35, RF-42, RF-43).
 */
export function UploadForm({
  accounts,
  toGoogle,
  onlyCafam,
  action,
}: {
  accounts: { id: string; email: string }[];
  toGoogle: number;
  onlyCafam: number;
  action: FormAction<UploadState>;
}) {
  const [state, formAction, pending] = useActionState(action, {
    values: { connectionId: accounts[0]?.id ?? "" },
  });

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      <FormAlert message={state.formError} />
      <Select
        label="Cuenta de Google"
        name="connectionId"
        defaultValue={state.values.connectionId}
        error={state.fieldErrors?.connectionId}
      >
        {accounts.map((account) => (
          <option key={account.id} value={account.id}>
            {account.email}
          </option>
        ))}
      </Select>
      <div className="flex flex-col gap-1 text-ink">
        <p className="tabular-nums">
          Se copiarán a Google <strong>{count(toGoogle)}</strong>.
        </p>
        {onlyCafam > 0 ? (
          <p className="tabular-nums">
            {count(onlyCafam)} se {onlyCafam === 1 ? "quedará" : "quedarán"}{" "}
            solo en CaFam: están fuera del rango que se sincroniza (de 6 meses
            antes de hoy a 1 año después) o pasan del máximo de 2.000.
          </p>
        ) : null}
        <p className="text-sm text-muted">
          Los miembros, las categorías y los colores siguen como están. Puede
          tardar unos minutos.
        </p>
      </div>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Subiendo…" : "Subir a Google"}
        </Button>
      </div>
    </form>
  );
}
