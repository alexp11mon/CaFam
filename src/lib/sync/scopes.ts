// Google permissions of spec 009 (plan D1, D2; RF-1, RF-5).

const API = "https://www.googleapis.com/auth/";

/** What an account needs to write; without any of them it stays read-only (D2). */
export const WRITE_SCOPES = [
  `${API}calendar.calendarlist.readonly`,
  `${API}calendar.events`,
  `${API}calendar.calendars`,
];

export const GOOGLE_SCOPES = ["openid", "email", ...WRITE_SCOPES].join(" ");

/** Spanish name of each permission, as Google shows it on its consent screen (RF-5). */
export const SCOPE_NAMES: Record<string, string> = {
  [`${API}calendar.calendarlist.readonly`]: "ver la lista de tus calendarios",
  [`${API}calendar.events`]: "ver y editar los eventos de tus calendarios",
  [`${API}calendar.calendars`]: "crear calendarios y cambiar su nombre",
};

/** Short name in the address after connecting: `calendar.events` (RF-5). */
export function shortScope(scope: string): string {
  return scope.slice(API.length);
}

/** The missing permissions of `?missing=`, ignoring anything unknown. */
export function missingFromQuery(value: string | undefined): string[] {
  const names = new Set((value ?? "").split(","));
  return WRITE_SCOPES.filter((scope) => names.has(shortScope(scope)));
}

/** The write permissions not in Google's `scope` answer (space separated). */
export function missingScopes(granted: string | null | undefined): string[] {
  const have = new Set((granted ?? "").split(/\s+/));
  return WRITE_SCOPES.filter((scope) => !have.has(scope));
}
