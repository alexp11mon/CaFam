import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageShell } from "@/components/calendar/page-shell";
import { ProviderNotice } from "@/components/connections/provider-notice";

export const metadata: Metadata = { title: "Conectar Google" };

async function Notice({
  searchParams,
}: {
  searchParams: Promise<{ provider?: string }>;
}) {
  if ((await searchParams).provider !== "google") notFound();
  return <ProviderNotice />;
}

/** The notice before Google's consent screen (RF-48). */
export default function NewConnectionPage({
  searchParams,
}: {
  searchParams: Promise<{ provider?: string }>;
}) {
  return (
    <PageShell
      title="Conectar Google"
      backHref="/dashboard/connections"
      backLabel="Volver a Cuentas conectadas"
    >
      <Suspense fallback={null}>
        <Notice searchParams={searchParams} />
      </Suspense>
    </PageShell>
  );
}
