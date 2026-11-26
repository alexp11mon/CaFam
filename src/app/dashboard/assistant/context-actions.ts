"use server";

import {
  getMyCalendars,
  getProfileTimeZone,
  requireActionUser,
} from "@/lib/calendar/queries";
import { canWriteEvents } from "@/lib/sync/read-only";

/**
 * The profile's zone, to show the cited events (spec 015 RF-1), and the
 * calendars where the user can create events, for the proposal (spec 022
 * RF-26). The chat asks for them once it is on screen (spec 024 RF-19).
 */
export async function loadAssistantContext(): Promise<{
  timeZone: string;
  calendars: { id: string; name: string }[];
  /** Spec 052 RF-9: "Guardar conversaciones". */
  saveChats: boolean;
}> {
  const { supabase, userId } = await requireActionUser();
  const [timeZone, all, profile] = await Promise.all([
    getProfileTimeZone(supabase, userId),
    getMyCalendars(supabase, userId),
    supabase
      .from("profiles")
      .select("save_chats")
      .eq("id", userId)
      .maybeSingle(),
  ]);
  return {
    timeZone,
    calendars: all.filter(canWriteEvents).map(({ id, name }) => ({ id, name })),
    saveChats: profile.data?.save_chats === true,
  };
}
