"use server";

import { requireActionUser } from "@/lib/calendar/queries";
import { MAX_QUERY } from "@/lib/search/limits";
import { searchEvents, searchRange } from "@/lib/search/queries";

/**
 * The search of the screen (spec 039 RF-3 to RF-5, RF-8). `moreBack` is how
 * many times "Buscar más atrás" was pressed. RLS decides what comes back.
 */
export async function runSearch(query: string, moreBack: number) {
  const { supabase } = await requireActionUser();
  const steps = Number.isInteger(moreBack)
    ? Math.min(Math.max(moreBack, 0), 10)
    : 0;
  return searchEvents(
    supabase,
    String(query).slice(0, MAX_QUERY),
    searchRange(new Date(), steps),
  );
}
