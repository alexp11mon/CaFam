"use client";

import { useSyncExternalStore } from "react";

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
  const show = useSyncExternalStore(subscribe, isIosSafariBrowser, () => false);
  if (!show) return null;

  return (
    <p className="rounded-lg bg-brand-soft/40 px-4 py-3 text-sm text-ink">
      Para instalar CalenderFam en tu iPhone o iPad, pulsa{" "}
      <strong>Compartir</strong> y después{" "}
      <strong>Añadir a pantalla de inicio</strong>.
    </p>
  );
}
