"use client";

import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/locale-provider";

export function RetryButton() {
  const t = useT();
  return (
    <Button type="button" onClick={() => window.location.reload()}>
      {t("Reintentar")}
    </Button>
  );
}
