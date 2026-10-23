// Read access for the spec 002 pages. Everything goes through RLS: a user only
// ever gets rows of calendars they belong to (P3).
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_ACCENT, isAccent, type AccentId } from "@/lib/theme/accents";
import type { CalendarPreference, Person, PersonPreference } from "./grouping";
import type { Database } from "@/types/database";

type Client = Awaited<ReturnType<typeof createClient>>;
type CalendarRole = Database["public"]["Enums"]["calendar_role"];

export interface CalendarRecord {
  id: string;
  name: string;
  description: string | null;
  color: string;
  // null for a calendar without owner (spec 006 RF-21); it is listed in the "Sin propietario" group.
  ownerId: string | null;
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
    owner_id: string | null;
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

const DEFAULT_TIME_ZONE = "Europe/Madrid";

/** The user's profile zone, in which events are typed and shown (RF-34). */
export async function getProfileTimeZone(
  supabase: Client,
  userId: string,
): Promise<string> {
  const { data, error } = await supabase
    .from("profiles")
    .select("time_zone")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data?.time_zone ?? DEFAULT_TIME_ZONE;
}

/** The user's interface accent; red if the row cannot be read (spec 005 RF-9, RF-10). */
export async function getAccent(
  supabase: Client,
  userId: string,
): Promise<AccentId> {
  const { data } = await supabase
    .from("profiles")
    .select("accent")
    .eq("id", userId)
    .maybeSingle();
  return isAccent(data?.accent) ? data.accent : DEFAULT_ACCENT;
}

export interface CategoryOptionRecord {
  id: string;
  name: string;
  calendarId: string;
}

/** Categories of several calendars at once, for the event form. */
export async function getCategoriesForCalendars(
  supabase: Client,
  calendarIds: string[],
): Promise<CategoryOptionRecord[]> {
  if (calendarIds.length === 0) return [];
  const { data, error } = await supabase
    .from("event_categories")
    .select("id, name, calendar_id")
    .in("calendar_id", calendarIds)
    .order("name");
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    calendarId: row.calendar_id,
  }));
}

export interface EventRecord {
  id: string;
  calendarId: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  color: string | null;
  categoryId: string | null;
  /** Null once the author deleted the account (spec 006 RF-20). */
  createdBy: string | null;
}

/** One event, or null if it does not exist, is not visible to the user or the id is malformed. */
export async function getEvent(
  supabase: Client,
  id: string,
): Promise<EventRecord | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const { data, error } = await supabase
    .from("events")
    .select(
      "id, calendar_id, title, description, location, starts_at, ends_at, all_day, color, category_id, created_by",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    calendarId: data.calendar_id,
    title: data.title,
    description: data.description,
    location: data.location,
    startsAt: data.starts_at,
    endsAt: data.ends_at,
    allDay: data.all_day,
    color: data.color,
    categoryId: data.category_id,
    createdBy: data.created_by,
  };
}

/** Whether RLS lets the user see the event: tells "gone" apart from "not yours". */
export async function canSeeEvent(
  supabase: Client,
  id: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("events")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  return Boolean(data);
}

export interface CalendarEventRecord {
  id: string;
  calendarId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  color: string | null;
  categoryId: string | null;
  location: string | null;
}

/**
 * Events of every calendar the user belongs to that overlap [from, to) (RF-31).
 * Columns are kept to the minimum the views draw (plan D14); RLS limits the rows.
 */
export async function getEventsInRange(
  supabase: Client,
  from: Date,
  to: Date,
): Promise<CalendarEventRecord[]> {
  const { data, error } = await supabase
    .from("events")
    .select(
      "id, calendar_id, title, starts_at, ends_at, all_day, color, category_id, location",
    )
    .lt("starts_at", to.toISOString())
    .gte("ends_at", from.toISOString())
    .order("starts_at");
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    calendarId: row.calendar_id,
    title: row.title,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    allDay: row.all_day,
    color: row.color,
    categoryId: row.category_id,
    // The agenda rows show the place (spec 005 RF-35).
    location: row.location,
  }));
}

/** People whose calendars the user shares, plus the user (RF-42). Names only, no time zone. */
export async function getPeople(supabase: Client): Promise<Person[]> {
  const { data, error } = await supabase.rpc("visible_people");
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    displayName: row.display_name,
  }));
}

/** The user's saved visibility and order (RF-46); RLS limits both tables to their own rows. */
export async function getPreferences(
  supabase: Client,
  userId: string,
): Promise<{
  calendarPreferences: CalendarPreference[];
  personPreferences: PersonPreference[];
}> {
  const [calendars, people] = await Promise.all([
    supabase
      .from("calendar_preferences")
      .select("calendar_id, visible, position")
      .eq("user_id", userId),
    supabase
      .from("person_preferences")
      .select("person_id, position")
      .eq("user_id", userId),
  ]);
  if (calendars.error) throw calendars.error;
  if (people.error) throw people.error;
  return {
    calendarPreferences: (calendars.data ?? []).map((row) => ({
      calendarId: row.calendar_id,
      visible: row.visible,
      position: row.position,
    })),
    personPreferences: (people.data ?? []).map((row) => ({
      personId: row.person_id,
      position: row.position,
    })),
  };
}

/** Number of events of each calendar, for the merge summary (RF-52). */
export async function getEventCounts(
  supabase: Client,
  calendarIds: string[],
): Promise<Record<string, number>> {
  const entries = await Promise.all(
    calendarIds.map(async (id) => {
      const { count, error } = await supabase
        .from("events")
        .select("id", { count: "exact", head: true })
        .eq("calendar_id", id);
      if (error) throw error;
      return [id, count ?? 0] as const;
    }),
  );
  return Object.fromEntries(entries);
}
