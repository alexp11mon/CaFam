"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import type { FormAction } from "@/lib/forms/form-state";

interface SyncNowState {
  message?: string;
  formError?: string;
}

/** "Actualizar ahora" with the summary or the wait announced (RF-23, RF-24). */
export function SyncNowButton({
  action,
}: {
  action: FormAction<SyncNowState>;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <Button
        type="submit"
        variant="secondary"
        disabled={pending}
        className="self-start"
      >
        {pending ? "Actualizando…" : "Actualizar ahora"}
      </Button>
      <FormAlert message={state.formError} />
      <p role="status" className="text-sm text-ink empty:hidden">
        {state.message}
      </p>
    </form>
  );
}
