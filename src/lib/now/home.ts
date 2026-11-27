// The screen the app opens on, saved in the account (spec 054 RF-24 to RF-26,
// plan D5). No zod here: the offline app imports it.

export const HOMES = ["calendar", "now"] as const;
export type Home = (typeof HOMES)[number];

export function isHome(value: unknown): value is Home {
  return HOMES.includes(value as Home);
}

/** Where /dashboard goes; the calendar when unset or unknown (RF-24). */
export function homeHref(home: unknown): string {
  return home === "now" ? "/dashboard/now" : "/dashboard/calendar";
}
