import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CalendarForm } from "@/components/calendar/calendar-form";
import { ConfirmDialog } from "@/components/calendar/confirm-dialog";
import { PageShell } from "@/components/calendar/page-shell";
import { getCalendar, requireUser } from "@/lib/calendar/queries";
import { deleteCalendar, updateCalendar } from "../../actions";

export const metadata: Metadata = { title: "Editar calendario" };

// Reads the session and the route param, so it streams behind <Suspense> (cacheComponents).
async function EditCalendar({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, userId } = await requireUser();
  const calendar = await getCalendar(supabase, userId, id);
  // Only the owner edits a calendar (RF-8); anyone else sees a 404.
  if (!calendar || calendar.role !== "owner") notFound();

  return (
    <>
      <CalendarForm
        action={updateCalendar.bind(null, id)}
        initial={{
          name: calendar.name,
          description: calendar.description ?? "",
          color: calendar.color,
        }}
        submitLabel="Guardar cambios"
        pendingLabel="Guardando…"
      />
      <section
        aria-labelledby="danger-heading"
        className="flex flex-col gap-3 border-t border-line pt-6"
      >
        <h2 id="danger-heading" className="text-lg font-semibold text-ink">
          Borrar calendario
        </h2>
        <p className="text-ink">
          Se borrarán también sus eventos y sus categorías.
        </p>
        <div>
          <ConfirmDialog
            triggerLabel="Borrar calendario"
            title={`¿Borrar «${calendar.name}»?`}
            description="Se borrarán también todos sus eventos y sus categorías. No se puede deshacer."
            confirmLabel="Sí, borrar"
            action={deleteCalendar.bind(null, id)}
          />
        </div>
      </section>
    </>
  );
}

export default function EditCalendarPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <PageShell title="Editar calendario">
      <Suspense fallback={<p className="text-muted">Cargando…</p>}>
        <EditCalendar params={params} />
      </Suspense>
    </PageShell>
  );
}
