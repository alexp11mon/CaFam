import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { NoteRole } from "./permissions";
import type { Note } from "./types";

type Client = SupabaseClient<Database>;

const NOTE_SELECT =
  "id, kind, title, body, color, pinned, archived, due_date, updated_at, owner_id, calendar_id, calendars(name), note_items(id, text, done, done_at, position)";

type Row = {
  id: string;
  kind: string;
  title: string;
  body: string;
  color: string | null;
  pinned: boolean;
  archived: boolean;
  due_date: string | null;
  updated_at: string;
  owner_id: string | null;
  calendar_id: string | null;
  calendars: { name: string } | null;
  note_items: {
    id: string;
    text: string;
    done: boolean;
    done_at: string | null;
    position: number;
  }[];
};

function toNote(row: Row): Note {
  return {
    id: row.id,
    kind: row.kind === "text" ? "text" : "list",
    title: row.title,
    body: row.body,
    color: row.color,
    pinned: row.pinned,
    archived: row.archived,
    dueDate: row.due_date,
    updatedAt: row.updated_at,
    ownerId: row.owner_id,
    calendarId: row.calendar_id,
    calendarName: row.calendars?.name ?? null,
    items: row.note_items.map((item) => ({
      id: item.id,
      text: item.text,
      done: item.done,
      doneAt: item.done_at,
      position: item.position,
    })),
  };
}

/** Every note the user can see, personal and shared, through RLS (P3). */
export async function getNotes(supabase: Client): Promise<Note[]> {
  const { data, error } = await supabase
    .from("notes")
    .select(NOTE_SELECT)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as Row[]).map(toNote);
}

/** One note, or null when it does not exist or is not the user's to see. */
export async function getNote(
  supabase: Client,
  id: string,
): Promise<Note | null> {
  const { data, error } = await supabase
    .from("notes")
    .select(NOTE_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? toNote(data as unknown as Row) : null;
}

/** The user's role in each of their calendars, for what a note offers. */
export async function getNoteRoles(
  supabase: Client,
  userId: string,
): Promise<{ calendarId: string; name: string; role: NoteRole }[]> {
  const { data, error } = await supabase
    .from("calendar_members")
    .select("calendar_id, role, calendars(name)")
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    calendarId: row.calendar_id,
    name: (row.calendars as unknown as { name: string } | null)?.name ?? "",
    role: row.role,
  }));
}
