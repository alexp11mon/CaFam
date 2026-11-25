import type { Metadata } from "next";
import { Suspense } from "react";
import { ShareInbox } from "@/components/share/share-inbox";

export const metadata: Metadata = { title: "Compartido" };

type Props = { searchParams: Promise<{ id?: string | string[] }> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function Inbox({ searchParams }: Props) {
  const { id } = await searchParams;
  return (
    <ShareInbox id={typeof id === "string" && UUID.test(id) ? id : null} />
  );
}

/** Where sw.js sends what another app shared (spec 047 RF-6 to RF-10). */
export default function SharePage(props: Props) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-4 sm:px-6 tab:py-6">
      <h1 className="text-2xl font-semibold text-ink">Compartido</h1>
      <Suspense
        fallback={
          <p role="status" className="text-muted">
            Cargando…
          </p>
        }
      >
        <Inbox {...props} />
      </Suspense>
    </main>
  );
}
