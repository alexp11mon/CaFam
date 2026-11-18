import { Logo } from "@/components/brand/logo";
import { Venito } from "@/components/brand/venito";
import type { Metadata } from "next";
import { RetryButton } from "@/components/pwa/retry-button";
import { OfflineApp } from "@/components/offline/offline-app";

export const metadata: Metadata = { title: "Sin conexión" };

/** Without a copy on the device: nothing to show (spec 001 RF-23, spec 034 RF-12). */
function NoCopy() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 text-center">
        <Logo />
        {/* Nothing to do without a network: Venito naps (spec 027 RF-7). */}
        <Venito mood="sleeping" className="size-28" />
        <h1 className="text-2xl font-semibold text-ink">Sin conexión</h1>
        <p className="text-muted">
          No hay conexión a internet. Comprueba tu red y vuelve a intentarlo.
        </p>
        <RetryButton />
      </div>
    </main>
  );
}

/**
 * Static page the service worker opens when a navigation fails (spec 034
 * plan D3): no data in its HTML; the offline app reads them from the device.
 */
export default function OfflinePage() {
  return <OfflineApp fallback={<NoCopy />} />;
}
