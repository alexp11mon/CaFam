import type { Metadata } from "next";
import { RetryButton } from "@/components/pwa/retry-button";

export const metadata: Metadata = { title: "Sin conexión" };

/** Static page the service worker shows when a navigation fails (RF-23). */
export default function OfflinePage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 text-center">
        <p className="text-sm font-semibold text-brand">CalenderFam</p>
        <h1 className="text-2xl font-bold text-ink">Sin conexión</h1>
        <p className="text-ink/80">
          No hay conexión a internet. Comprueba tu red y vuelve a intentarlo.
        </p>
        <RetryButton />
      </div>
    </main>
  );
}
