"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useToast } from "@/components/ui/toast";

/**
 * The window's event no longer exists, usually because it was just deleted
 * there: the revalidated route comes back empty before the delete dialog can
 * close the window, so this closes it (spec 008 RF-8, RF-32).
 */
export function GoneEvent() {
  const router = useRouter();
  const { show } = useToast();

  useEffect(() => {
    show("Evento borrado");
    router.back();
  }, [router, show]);

  return null;
}
