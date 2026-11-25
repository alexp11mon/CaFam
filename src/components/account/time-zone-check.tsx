"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useToast } from "@/components/ui/toast";

// Spec 050 RF-4: an account made with Google got Europe/Madrid, because Google
// does not say the zone. On the first entry (?tzcheck=<zone>, from
// /auth/callback) the browser's zone is compared and a notice offers to change.

/** The notice to show, or null when the zone matches the browser's. */
export function zoneNotice(
  saved: string | null,
  browser: string,
): string | null {
  if (!saved || !browser || saved === browser) return null;
  return `Hemos puesto tu zona en ${saved}. ¿Es correcta?`;
}

export function TimeZoneCheck() {
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
      label: "Cambiar",
      keys: false,
      undo: async () => {
        router.push("/dashboard/settings#settings-profile");
      },
    });
  }, [show, router]);
  return null;
}
