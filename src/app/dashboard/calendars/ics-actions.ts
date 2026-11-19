"use server";

import { revalidatePath } from "next/cache";
import { requireActionUser } from "@/lib/calendar/queries";
import { refreshNow } from "@/lib/ics/refresh-engine";

// "Actualizar ahora", "Reintentar" and "Dejar de actualizar" of a calendar kept
// updated from a link (spec 044 RF-6, RF-10). The database checks the role.

const REFRESH_TEXT = {
  ok: "Calendario actualizado desde su enlace.",
  failed: "No se ha podido actualizar desde el enlace.",
  too_soon: "Se acaba de actualizar: espera unos minutos.",
} as const;

export async function refreshIcsSubscription(
  calendarId: string,
): Promise<{ message: string }> {
  const { supabase } = await requireActionUser();
  try {
    const { status } = await refreshNow(supabase, calendarId);
    revalidatePath("/dashboard", "layout");
    return { message: REFRESH_TEXT[status] };
  } catch {
    return { message: REFRESH_TEXT.failed };
  }
}

export async function stopIcsSubscription(
  calendarId: string,
): Promise<{ message: string }> {
  const { supabase } = await requireActionUser();
  const { error } = await supabase.rpc("stop_ics_subscription", {
    p_calendar_id: calendarId,
  });
  if (error) return { message: "No se ha podido dejar de actualizar." };
  revalidatePath("/dashboard", "layout");
  return {
    message: "Ya no se actualiza desde el enlace. Los eventos se quedan.",
  };
}
