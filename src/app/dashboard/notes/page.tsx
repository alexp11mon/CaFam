import type { Metadata } from "next";

export const metadata: Metadata = { title: "Notas" };

// Spec 025 RF-8: the destination exists in the navigation from now on; the
// screen itself arrives with spec 028.
export default function NotesPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-bold text-ink max-tab:sr-only">Notas</h1>
      <div className="surface flex flex-col items-center gap-2 rounded-card px-4 py-10 text-center">
        <p className="text-lg font-bold text-ink">Notas está en camino</p>
        <p className="text-muted">
          Aquí podrás apuntar listas de tareas y notas. Llega muy pronto.
        </p>
      </div>
    </main>
  );
}
