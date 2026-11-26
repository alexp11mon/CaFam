import type { Metadata } from "next";
import { Suspense } from "react";
import { SearchScreen } from "@/components/search/search-screen";
import {
  getMyCalendars,
  getPreferences,
  getProfileTimeZone,
  requireUser,
} from "@/lib/calendar/queries";
import { runSearch } from "./actions";
import { T } from "@/components/i18n/locale-provider";

export const metadata: Metadata = { title: "Buscar" };

// Reads the session, so it streams behind <Suspense> (cacheComponents).
type Props = { searchParams: Promise<{ q?: string | string[] }> };

async function Search({ searchParams }: Props) {
  const { supabase, userId } = await requireUser();
  const [{ q }, calendars, { calendarPreferences }, timeZone] =
    await Promise.all([
      searchParams,
      getMyCalendars(supabase, userId),
      getPreferences(supabase, userId),
      getProfileTimeZone(supabase, userId),
    ]);
  const hidden = new Set(
    calendarPreferences
      .filter((preference) => !preference.visible)
      .map((preference) => preference.calendarId),
  );
  return (
    <SearchScreen
      initialQuery={typeof q === "string" ? q : ""}
      timeZone={timeZone}
      calendars={calendars.map((calendar) => ({
        id: calendar.id,
        name: calendar.name,
        color: calendar.color,
        hidden: hidden.has(calendar.id),
      }))}
      search={runSearch}
    />
  );
}

/** The event search (spec 039 RF-2). */
export default function SearchPage(props: Props) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-4 sm:px-6 tab:py-6">
      <h1 className="text-2xl font-semibold text-ink max-tab:sr-only">
        <T>{"Buscar"}</T>
      </h1>
      <Suspense
        fallback={
          <p role="status" className="text-muted">
            <T>{"Cargando…"}</T>
          </p>
        }
      >
        <Search {...props} />
      </Suspense>
    </main>
  );
}
