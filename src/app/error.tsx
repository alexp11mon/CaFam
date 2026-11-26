"use client";

import { Button } from "@/components/ui/button";
import { ErrorScreen } from "@/components/ui/error-screen";
import { LinkButton } from "@/components/ui/link-button";
import { useT } from "@/components/i18n/locale-provider";

/** A page that fails to render, in Spanish and with a way out (spec 023 RF-17). */
export default function ErrorPage({ retry }: { retry: () => void }) {
  const t = useT();
  return (
    <ErrorScreen
      title={t("Algo ha fallado")}
      text={t(
        "No hemos podido mostrar esta página. Vuelve a intentarlo dentro de un momento.",
      )}
    >
      <Button onClick={() => retry()}>{t("Reintentar")}</Button>
      <LinkButton href="/dashboard/calendar" variant="secondary">
        {t("Ir al calendario")}
      </LinkButton>
    </ErrorScreen>
  );
}
