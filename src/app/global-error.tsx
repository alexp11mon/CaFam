"use client";

import { Button } from "@/components/ui/button";
import { ErrorScreen } from "@/components/ui/error-screen";
import "./globals.css";
import { useT } from "@/components/i18n/locale-provider";

/**
 * A failure in the root layout itself: this replaces it, so it brings its own
 * document and styles and follows the system theme (spec 023 RF-17).
 */
export default function GlobalError({ retry }: { retry: () => void }) {
  const t = useT();
  return (
    <html lang="es" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <title>{t("Algo ha fallado · CaFam")}</title>
        <ErrorScreen
          title={t("Algo ha fallado")}
          text={t(
            "No hemos podido abrir CaFam. Vuelve a intentarlo dentro de un momento.",
          )}
        >
          <Button onClick={() => retry()}>{t("Reintentar")}</Button>
        </ErrorScreen>
      </body>
    </html>
  );
}
