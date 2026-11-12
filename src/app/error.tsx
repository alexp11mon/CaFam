"use client";

import { Button } from "@/components/ui/button";
import { ErrorScreen } from "@/components/ui/error-screen";
import { LinkButton } from "@/components/ui/link-button";

/** A page that fails to render, in Spanish and with a way out (spec 023 RF-17). */
export default function ErrorPage({ retry }: { retry: () => void }) {
  return (
    <ErrorScreen
      title="Algo ha fallado"
      text="No hemos podido mostrar esta página. Vuelve a intentarlo dentro de un momento."
    >
      <Button onClick={() => retry()}>Reintentar</Button>
      <LinkButton href="/dashboard/calendar" variant="secondary">
        Ir al calendario
      </LinkButton>
    </ErrorScreen>
  );
}
