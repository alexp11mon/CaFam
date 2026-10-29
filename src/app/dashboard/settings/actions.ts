"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { CALENDAR_MESSAGES } from "@/lib/calendar/error-messages";
import { requireActionUser } from "@/lib/calendar/queries";
import { accentSchema } from "@/lib/theme/accents";
import {
  THEME_COOKIE,
  THEME_COOKIE_OPTIONS,
  themeSchema,
} from "@/lib/theme/theme";

type Result = { error?: string };

const NOT_SAVED = "No se ha podido guardar el color. Inténtalo de nuevo.";

/** Saves the interface accent in the user's own profile row (spec 005 RF-8, RF-12, RF-13). */
export async function setAccent(accent: string): Promise<Result> {
  const parsed = accentSchema.safeParse(accent);
  if (!parsed.success) return { error: parsed.error.issues[0]!.message };

  const { supabase, userId } = await requireActionUser();
  try {
    // RLS limits the update to the user's row; 0 rows back means nothing was saved.
    const { data, error } = await supabase
      .from("profiles")
      .update({ accent: parsed.data })
      .eq("id", userId)
      .select("id");
    if (error || !data?.length) return { error: NOT_SAVED };
  } catch {
    return { error: CALENDAR_MESSAGES.connection };
  }
  // The frame reads the accent on the server: refresh it for the next navigation.
  revalidatePath("/dashboard", "layout");
  return {};
}

const THEME_NOT_SAVED = "No se ha podido guardar el tema. Inténtalo de nuevo.";

/** Saves the theme in the user's own profile row and on this device (spec 011 RF-4). */
export async function setTheme(theme: string): Promise<Result> {
  const parsed = themeSchema.safeParse(theme);
  if (!parsed.success) return { error: parsed.error.issues[0]!.message };

  const { supabase, userId } = await requireActionUser();
  try {
    const { data, error } = await supabase
      .from("profiles")
      .update({ theme: parsed.data })
      .eq("id", userId)
      .select("id");
    if (error || !data?.length) return { error: THEME_NOT_SAVED };
  } catch {
    return { error: CALENDAR_MESSAGES.connection };
  }
  (await cookies()).set(THEME_COOKIE, parsed.data, THEME_COOKIE_OPTIONS);
  revalidatePath("/dashboard", "layout");
  return {};
}
