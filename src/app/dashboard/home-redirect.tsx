import { redirect } from "next/navigation";
import { getCalendarProfile, requireUser } from "@/lib/calendar/queries";
import { homeHref } from "@/lib/now/home";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

/**
 * Sends /dashboard to the home screen of the account (spec 054 RF-25, D5),
 * keeping the query: a new Google account brings ?tzcheck= (spec 050 RF-4).
 */
export async function HomeRedirect({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<null> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const item of [value ?? []].flat()) query.append(key, item);
  }
  const { supabase, userId } = await requireUser();
  const { home } = await getCalendarProfile(supabase, userId);
  const search = query.toString();
  redirect(search ? `${homeHref(home)}?${search}` : homeHref(home));
}
