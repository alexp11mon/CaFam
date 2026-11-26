"use client";

import { useNow } from "@/lib/hooks/use-now";
import { useT } from "@/components/i18n/locale-provider";
import { staleCopyText } from "@/lib/sync/provider-labels";
import type { ProviderName } from "@/lib/sync/providers/types";
import { isOutsideWindow } from "@/lib/sync/window";

/** An old synced event is a copy the sync no longer reads (spec 038 RF-6). */
export function StaleCopyNote({
  startsAt,
  provider,
}: {
  startsAt: string;
  provider: ProviderName;
}) {
  const now = useNow();
  const t = useT();
  if (now === null || !isOutsideWindow(startsAt, new Date(now))) return null;
  return <p className="text-sm text-muted">{staleCopyText(provider, t)}</p>;
}
