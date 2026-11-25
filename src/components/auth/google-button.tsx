"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { GoogleLogo } from "@/components/brand/google-logo";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { googleLoginEnabled } from "@/lib/auth/google-login";
import { NextField } from "./next-field";

// Spec 050, T2: "Continuar con Google" in the login and the sign-up (RF-1,
// RF-9). Hidden until the provider is set up in Supabase (spec "Riesgos").

export const GOOGLE_TEXTS = {
  cancelled: "Has cancelado el inicio de sesión con Google.",
  error: "No se ha podido entrar con Google.",
} as const;

function GoogleNotice() {
  const reason = useSearchParams()?.get("google");
  const message =
    reason === "cancelled"
      ? GOOGLE_TEXTS.cancelled
      : reason === "error"
        ? GOOGLE_TEXTS.error
        : undefined;
  return <FormAlert message={message} />;
}

export function GoogleButton({
  action,
}: {
  action: (formData: FormData) => Promise<void>;
}) {
  if (!googleLoginEnabled()) return null;
  return (
    <div className="mb-4 flex flex-col gap-4">
      <Suspense fallback={null}>
        <GoogleNotice />
      </Suspense>
      <form action={action} className="flex flex-col">
        <NextField />
        <Button type="submit" variant="secondary" className="gap-3">
          <GoogleLogo />
          Continuar con Google
        </Button>
      </form>
      <p
        className="flex items-center gap-3 text-sm text-muted before:h-px before:flex-1 before:bg-line after:h-px after:flex-1 after:bg-line"
        aria-hidden="true"
      >
        o
      </p>
    </div>
  );
}
