"use client";

import { useState } from "react";
import { useConnection } from "@/lib/hooks/use-connection";
import { OFFLINE_MESSAGES } from "@/lib/offline/messages";
import { useT } from "@/components/i18n/locale-provider";

/** Tells screen readers when the connection goes or comes back (RF-10). */
export function ConnectionAnnouncer() {
  const t = useT();
  const online = useConnection();
  // Nothing is said on the first paint, only on a change.
  const [seen, setSeen] = useState({ online, changed: false });
  if (seen.online !== online) setSeen({ online, changed: true });
  const text = online
    ? t(OFFLINE_MESSAGES.online)
    : t(OFFLINE_MESSAGES.offline);
  return (
    <p role="status" aria-live="polite" className="sr-only">
      {seen.changed ? text : ""}
    </p>
  );
}
