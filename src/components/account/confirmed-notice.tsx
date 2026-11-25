"use client";

import { useEffect } from "react";
import { useToast } from "@/components/ui/toast";

export const CONFIRMED_TEXT = "Email confirmado";

/**
 * "Email confirmado" after the signup link (spec 049 RF-2): read once from the
 * URL, then removed so a reload does not repeat it.
 */
export function ConfirmedNotice() {
  const { show } = useToast();
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("confirmed") !== "1") return;
    show(CONFIRMED_TEXT);
    url.searchParams.delete("confirmed");
    window.history.replaceState(window.history.state, "", url);
  }, [show]);
  return null;
}
