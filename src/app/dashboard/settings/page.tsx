import type { Metadata } from "next";
import { Suspense } from "react";
import { AccentPicker } from "@/components/settings/accent-picker";
import { getAccent, requireUser } from "@/lib/calendar/queries";
import { setAccent } from "./actions";

export const metadata: Metadata = { title: "Ajustes" };

// Reads the session, so it streams behind <Suspense> (cacheComponents).
async function AccentSection() {
  const { supabase, userId } = await requireUser();
  const accent = await getAccent(supabase, userId);
  return <AccentPicker current={accent} setAccent={setAccent} />;
}

/** Ajustes: for now only the interface accent (spec 005 RF-6; the account comes in 006). */
export default function SettingsPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-bold text-ink">Ajustes</h1>
      <section className="rounded-3xl bg-paper p-5 sm:p-6">
        <Suspense fallback={<p className="text-muted">Cargando ajustes…</p>}>
          <AccentSection />
        </Suspense>
      </section>
    </main>
  );
}
