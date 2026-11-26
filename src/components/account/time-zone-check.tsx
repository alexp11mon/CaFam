"use client";
import { spanishT, type T } from "@/lib/i18n/translate";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useToast } from "@/components/ui/toast";
import { useT } from "@/components/i18n/locale-provider";

// Spec 050 RF-4: an account made with Google got Europe/Madrid, because Google
// does not say the zone. On the first entry (?tzcheck=<zone>, from
// /auth/callback) the browser's zone is compared and a notice offers to change.

/** The notice to show, or null when the zone matches the browser's. */
export function zoneNotice(
  saved: string | null,
  browser: string,
  t: T = spanishT,
): string | null {
  if (!saved || !browser || saved === browser) return null;
  return t("Hemos puesto tu zona en {saved}. ¿Es correcta?", { saved });
}

export function TimeZoneCheck() {
  const t = useT();
  const { show } = useToast();
  const router = useRouter();
  useEffect(() => {
    const url = new URL(window.location.href);
    const saved = url.searchParams.get("tzcheck");
    if (saved === null) return;
    url.searchParams.delete("tzcheck");
    window.history.replaceState(window.history.state, "", url);
    const text = zoneNotice(
      saved,
      Intl.DateTimeFormat().resolvedOptions().timeZone ?? "",
    );
    if (!text) return;
    show(text, {
      label: t("Cambiar"),
      keys: false,
      undo: async () => {
        router.push("/dashboard/settings#settings-profile");
      },
    });
  }, [show, router, t]);
  return null;
}
