// Read access for the spec 002 pages. Everything goes through RLS: a user only
// ever gets rows of calendars they belong to (P3).
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type Client = Awaited<ReturnType<typeof createClient>>;
type CalendarRole = Database["public"]["Enums"]["calendar_role"];

export interface CalendarRecord {
  id: string;
  name: string;
  description: string | null;
  color: string;
  ownerId: string;
  createdAt: string;
  role: CalendarRole;
}

/** Session for a Server Action or Route Handler; no session means login. */
export async function requireActionUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) redirect("/login");
  return { supabase, userId };
}

/** Session for a Server Component: Supabase reads Date.now(), so render per request. */
export async function requireUser() {
  await connection();
  return requireActionUser();
}

const CALENDAR_SELECT =
  "role, calendars(id, name, description, color, owner_id, created_at)";

type CalendarRow = {
  role: CalendarRole;
  calendars: {
    id: string;
    name: string;
    description: string | null;
    color: string;
    owner_id: string;
    created_at: string;
  } | null;
};

function toRecord({ role, calendars }: CalendarRow): CalendarRecord[] {
  return calendars
    ? [
        {
          id: calendars.id,
          name: calendars.name,
          description: calendars.description,
          color: calendars.color,
          ownerId: calendars.owner_id,
          createdAt: calendars.created_at,
          role,
        },
      ]
    : [];
}

/** Calendars the user belongs to, with their role (RF-13). */
export async function getMyCalendars(
  supabase: Client,
  userId: string,
): Promise<CalendarRecord[]> {
  // RLS returns every member of my calendars; filtering by user_id keeps my role.
  const { data, error } = await supabase
    .from("calendar_members")
    .select(CALENDAR_SELECT)
    .eq("user_id", userId)
    .order("created_at");
  if (error) throw error;
  return (data ?? []).flatMap(toRecord);
}

/** One calendar of the user, or null if it does not exist, is not theirs or the id is malformed. */
export async function getCalendar(
  supabase: Client,
  userId: string,
  id: string,
): Promise<CalendarRecord | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const { data, error } = await supabase
    .from("calendar_members")
    .select(CALENDAR_SELECT)
    .eq("user_id", userId)
    .eq("calendar_id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? (toRecord(data)[0] ?? null) : null;
}

/** Whether RLS lets the user see the calendar: tells "gone" apart from "not yours". */
export async function canSeeCalendar(
  supabase: Client,
  id: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("calendars")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  return Boolean(data);
}

export interface CategoryRecord {
  id: string;
  name: string;
}

/** Categories of one calendar, alphabetical (RF-13). RLS limits them to members. */
export async function getCategories(
  supabase: Client,
  calendarId: string,
): Promise<CategoryRecord[]> {
  const { data, error } = await supabase
    .from("event_categories")
    .select("id, name")
    .eq("calendar_id", calendarId)
    .order("name");
  if (error) throw error;
  return data ?? [];
}
