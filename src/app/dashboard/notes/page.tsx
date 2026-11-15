import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Notas" };

// Spec 025 RF-8: the destination exists in the navigation from now on; the
// screen itself arrives with spec 028.
export default function NotesPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-bold text-ink max-tab:sr-only">Notas</h1>
      <Card>
        <EmptyState title="Notas está en camino">
          Aquí podrás apuntar listas de tareas y notas. Llega muy pronto.
        </EmptyState>
      </Card>
    </main>
  );
}
