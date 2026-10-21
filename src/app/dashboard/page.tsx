import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import {
  CalendarList,
  type CalendarListItem,
} from "@/components/dashboard/calendar-list";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "../(auth)/actions";

export const metadata: Metadata = { title: "Panel" };

async function getCurrentUserId() {
  // Supabase reads Date.now() to check the session: render per request.
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) redirect("/login");
  return { supabase, userId };
}

// Reads the session cookies, so it streams behind <Suspense> (cacheComponents).
async function Greeting() {
  const { supabase, userId } = await getCurrentUserId();
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .single();

  return <>Hola, {profile?.display_name}</>;
}

async function Calendars() {
  const { supabase, userId } = await getCurrentUserId();
  // RLS returns every member of my calendars; filtering by user_id keeps my role (RF-13).
  const { data } = await supabase
    .from("calendar_members")
    .select("role, calendars(id, name, color)")
    .eq("user_id", userId)
    .order("created_at");

  const calendars: CalendarListItem[] = (data ?? []).flatMap(
    ({ role, calendars: calendar }) =>
      calendar ? [{ ...calendar, role }] : [],
  );

  return <CalendarList calendars={calendars} />;
}

export default function DashboardPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-ink/10 pb-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-brand">CalenderFam</p>
          <h1 className="truncate text-xl font-bold text-ink sm:text-2xl">
            <Suspense fallback="Hola">
              <Greeting />
            </Suspense>
          </h1>
        </div>
        <form action={signOut}>
          <Button type="submit">Cerrar sesión</Button>
        </form>
      </header>
      <section
        aria-labelledby="calendars-heading"
        className="flex flex-col gap-4"
      >
        <h2 id="calendars-heading" className="text-lg font-semibold text-ink">
          Tus calendarios
        </h2>
        <Suspense
          fallback={<p className="text-ink/70">Cargando calendarios…</p>}
        >
          <Calendars />
        </Suspense>
      </section>
    </main>
  );
}
