"use server";

import { allRows, requireActionUser } from "@/lib/calendar/queries";
import { exportIcs } from "@/lib/ics/export-queries";
import { getMembers } from "@/lib/sharing/queries";
import type { AccountExport } from "@/lib/export/account-export";

// Spec 049, T5: what "Descargar mis datos" puts in the .zip, read with the
// user's session (RLS), so it can only hold what the app already shows them
// (RF-13, RF-14). Members go by name; no other email, token or password.

export async function loadAccountExport(): Promise<AccountExport | null> {
  try {
    const { supabase, userId } = await requireActionUser();
    const [user, profile, memberships, comments, notes, images] =
      await Promise.all([
        supabase.auth.getUser(),
        supabase
          .from("profiles")
          .select(
            "display_name, time_zone, accent, theme, last_view, default_event_minutes, show_weekends, show_tasks, share_busy, share_availability, reminder_minutes, reminder_all_day_minutes, notify, badge_today, created_at",
          )
          .eq("id", userId)
          .single(),
        supabase
          .from("calendar_members")
          .select(
            "role, calendars(id, name, description, color, event_categories(name))",
          )
          .eq("user_id", userId),
        allRows((first, last) =>
          supabase
            .from("event_comments")
            .select("body, created_at, edited_at, events(title, starts_at)")
            .eq("author_id", userId)
            .order("created_at")
            .range(first, last),
        ),
        allRows((first, last) =>
          supabase
            .from("notes")
            .select(
              "kind, title, body, color, pinned, archived, due_date, created_at, updated_at, calendars(name), note_items(text, done, due_date, due_time, position)",
            )
            .eq("owner_id", userId)
            .order("created_at")
            .range(first, last),
        ),
        allRows((first, last) =>
          supabase
            .from("event_images")
            .select("object_id, event_id, created_at, events(title)")
            .eq("uploaded_by", userId)
            .eq("status", "ready")
            .order("created_at")
            .range(first, last),
        ),
      ]);
    if (profile.error) throw profile.error;
    if (memberships.error) throw memberships.error;

    const calendars = (memberships.data ?? []).flatMap((row) =>
      row.calendars ? [{ ...row.calendars, role: row.role }] : [],
    );
    const members = await getMembers(
      supabase,
      calendars.map((calendar) => calendar.id),
    );
    const { display_name, ...settings } = profile.data;

    return {
      profile: {
        name: display_name,
        email: user.data.user?.email ?? "",
        ...settings,
      },
      calendars: calendars.map(({ event_categories, ...calendar }) => ({
        ...calendar,
        categories: (event_categories ?? []).map((category) => category.name),
        members: members
          .filter((member) => member.calendarId === calendar.id)
          .map((member) => ({ name: member.name, role: member.role })),
      })),
      comments: comments.map((comment) => ({
        body: comment.body,
        createdAt: comment.created_at,
        editedAt: comment.edited_at,
        event: comment.events
          ? { title: comment.events.title, startsAt: comment.events.starts_at }
          : null,
      })),
      notes: notes.map(({ calendars: shared, note_items, ...note }) => ({
        ...note,
        calendar: shared?.name ?? null,
        items: [...(note_items ?? [])]
          .sort((a, b) => a.position - b.position)
          .map(({ text, done, due_date, due_time }) => ({
            text,
            done,
            due_date,
            due_time,
          })),
      })),
      images: images.map((image) => ({
        objectId: image.object_id,
        eventId: image.event_id,
        eventTitle: image.events?.title ?? "",
      })),
    };
  } catch {
    return null;
  }
}

/** The .ics of one calendar the user is a member of (spec 043 writer). */
export async function loadCalendarIcs(
  calendarId: string,
): Promise<string | null> {
  try {
    const { supabase, userId } = await requireActionUser();
    const file = await exportIcs(supabase, userId, { calendarId }, new Date());
    return file?.text ?? null;
  } catch {
    return null;
  }
}
