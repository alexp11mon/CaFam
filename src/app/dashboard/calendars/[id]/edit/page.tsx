import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CalendarForm } from "@/components/calendar/calendar-form";
import { ConfirmDialog } from "@/components/calendar/confirm-dialog";
import { PageShell } from "@/components/calendar/page-shell";
import { TransferDialog } from "@/components/sharing/transfer-dialog";
import { getCalendar, requireUser } from "@/lib/calendar/queries";
import { getMembers } from "@/lib/sharing/queries";
import { TRANSFER_TEXTS } from "@/lib/sharing/transfer-texts";
import { deleteCalendar, updateCalendar } from "../../actions";
import { transferCalendar } from "../../transfer-actions";
import { T } from "@/components/i18n/locale-provider";

export const metadata: Metadata = { title: "Editar calendario" };

// Reads the session and the route param, so it streams behind <Suspense> (cacheComponents).
async function EditCalendar({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, userId } = await requireUser();
  const calendar = await getCalendar(supabase, userId, id);
  // Only the owner edits a calendar (RF-8); anyone else sees a 404.
  if (!calendar || calendar.role !== "owner") notFound();
  const others = calendar.synced
    ? []
    : (await getMembers(supabase, [id])).flatMap((member) =>
        member.role === "owner"
          ? []
          : [{ userId: member.userId, name: member.name, role: member.role }],
      );

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
        aria-labelledby="transfer-heading"
        className="flex flex-col gap-3 border-t border-line pt-6"
      >
        <h2 id="transfer-heading" className="text-lg font-semibold text-ink">
          <T>{"Traspasar el calendario"}</T>
        </h2>
        {calendar.synced ? (
          // RF-9: the connected account is the owner's.
          <p className="text-ink">{TRANSFER_TEXTS.synced}</p>
        ) : others.length ? (
          <>
            <p className="text-ink">
              <T>
                {
                  "Otra persona del calendario pasa a tener su propiedad y tú te quedas como Editor."
                }
              </T>
            </p>
            <div>
              <TransferDialog
                calendarName={calendar.name}
                members={others}
                action={transferCalendar.bind(null, id)}
              />
            </div>
          </>
        ) : (
          <p className="text-muted">
            <T>{"Invita a alguien al calendario para poder traspasárselo."}</T>
          </p>
        )}
      </section>
      <section
        aria-labelledby="danger-heading"
        className="flex flex-col gap-3 border-t border-line pt-6"
      >
        <h2 id="danger-heading" className="text-lg font-semibold text-ink">
          <T>{"Borrar calendario"}</T>
        </h2>
        <p className="text-ink">
          <T>{"Se borrarán también sus eventos y sus categorías."}</T>
        </p>
        <div>
          <ConfirmDialog
            triggerLabel="Borrar calendario"
            title="¿Borrar «{name}»?"
            vars={{ name: calendar.name }}
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
      <Suspense
        fallback={
          <p className="text-muted">
            <T>{"Cargando…"}</T>
          </p>
        }
      >
        <EditCalendar params={params} />
      </Suspense>
    </PageShell>
  );
}
