// Spec 051 RF-12: measures the range read of getEventsInRange with 20,000
// events in 30 calendars, as an authenticated user (RLS applies), with
// EXPLAIN (ANALYZE, BUFFERS) through `supabase db query --linked` (dev).
//
//   node --env-file=.env.test.local scripts/perf/range-explain.mjs
//
// It seeds a @cafam.test user and deletes it at the end.
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const CALENDARS = 30;
const EVENTS = 20_000;

const { data: created, error } = await admin.auth.admin.createUser({
  email: `test-${randomUUID()}@cafam.test`,
  password: "test-password-1234",
  email_confirm: true,
  user_metadata: { display_name: "Rango", time_zone: "Europe/Madrid" },
});
if (error) throw error;
const userId = created.user.id;

// Through a file: with `shell` (needed for npx on Windows) the arguments are
// not quoted.
function sql(query) {
  const file = join(tmpdir(), `range-explain-${randomUUID()}.sql`);
  writeFileSync(file, query);
  try {
    return execFileSync(
      "npx",
      ["supabase", "db", "query", "--linked", "-f", file],
      { encoding: "utf8", shell: true, maxBuffer: 16 * 1024 * 1024 },
    );
  } finally {
    rmSync(file);
  }
}

try {
  const { data: calendars, error: calError } = await admin
    .from("calendars")
    .insert(
      Array.from({ length: CALENDARS }, (_, i) => ({
        name: `Rango ${i + 1}`,
        owner_id: userId,
      })),
    )
    .select("id");
  if (calError) throw calError;

  // Two years of events around today, spread over the calendars.
  const day = 86_400_000;
  const start = Date.now() - 365 * day;
  for (let first = 0; first < EVENTS; first += 1000) {
    const rows = Array.from({ length: 1000 }, (_, i) => {
      const at = start + Math.floor(((first + i) / EVENTS) * 730 * day);
      return {
        calendar_id: calendars[(first + i) % CALENDARS].id,
        title: `Evento ${first + i}`,
        starts_at: new Date(at).toISOString(),
        ends_at: new Date(at + 3_600_000).toISOString(),
        created_by: userId,
      };
    });
    const { error: insertError } = await admin.from("events").insert(rows);
    if (insertError) throw insertError;
  }
  sql("analyze public.events;");

  // The window of the calendar (spec 024): a month around today.
  const from = new Date(Date.now() - 14 * day).toISOString();
  const to = new Date(Date.now() + 28 * day).toISOString();
  const claims = JSON.stringify({ sub: userId, role: "authenticated" });
  const output = sql(`
    begin;
    set local role authenticated;
    select set_config('request.jwt.claims', '${claims}', true);
    explain (analyze, buffers)
      select id, calendar_id, title, starts_at, ends_at, all_day, color,
             category_id, location, series_id
      from public.events
      where recurrence is null
        and starts_at < '${to}' and ends_at >= '${from}'
      order by starts_at, id
      limit 1000;
    rollback;
  `);
  console.log(output);
} finally {
  await admin.auth.admin.deleteUser(userId);
}
