"use client";

import { useSyncExternalStore } from "react";
import { useT } from "@/components/i18n/locale-provider";

function isIosSafariBrowser(): boolean {
  const { userAgent, maxTouchPoints } = navigator;
  // iPadOS reports itself as a Mac; touch support gives it away.
  const isIos =
    /iPad|iPhone|iPod/.test(userAgent) ||
    (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
  // Chrome, Firefox and Edge on iOS cannot add web apps to the home screen.
  const isSafari = !/CriOS|FxiOS|EdgiOS|OPiOS/.test(userAgent);
  const isInstalled =
    ("standalone" in navigator && navigator.standalone === true) ||
    window.matchMedia("(display-mode: standalone)").matches;
  return isIos && isSafari && !isInstalled;
}

const subscribe = () => () => {};

/** iOS shows no install prompt, so Safari users get the steps (plan R7, RF-22). */
export function IosInstallHint() {
  const t = useT();
  const show = useSyncExternalStore(subscribe, isIosSafariBrowser, () => false);
  if (!show) return null;

  return (
    <p className="rounded-control bg-paper px-4 py-3 text-sm text-ink">
      {t("Para instalar CaFam en tu iPhone o iPad, pulsa")}{" "}
      <strong>{t("Compartir")}</strong> {t("y después")}{" "}
      <strong>{t("Añadir a pantalla de inicio")}</strong>.
    </p>
  );
}
