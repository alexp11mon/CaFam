import { addDays, formatTime, zonedDateKey } from "@/lib/calendar/time-zone";
import { dateFormat } from "@/lib/i18n/format";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locale";

// When a comment was written, in the profile's time zone (RF-2).

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

function shortDay(
  instant: string,
  timeZone: string,
  withYear: boolean,
  locale: Locale,
) {
  const parts = dateFormat(locale, {
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
    timeZone,
  }).formatToParts(new Date(instant));
  // "20 oct" and "31 dic 2025": no dots or "de".
  return parts
    .filter((part) => part.type !== "literal")
    .map((part) => part.value.replace(".", ""))
    .join(" ");
}

/** "ahora", "hace 5 min", "hace 2 h", "ayer a las 18:30", "20 oct a las 10:05" or "31 dic 2025". */
export function relativeTime(
  instant: string,
  now: Date,
  timeZone: string,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const en = locale === "en";
  const elapsed = now.getTime() - Date.parse(instant);
  // A clock ahead of the database's says "ahora", never "en 5 s".
  if (elapsed < MINUTE) return en ? "now" : "ahora";
  const minutes = Math.floor(elapsed / MINUTE);
  if (elapsed < HOUR) return en ? `${minutes} min ago` : `hace ${minutes} min`;

  const day = zonedDateKey(instant, timeZone);
  const today = zonedDateKey(now, timeZone);
  const time = formatTime(instant, timeZone);
  const hours = Math.floor(elapsed / HOUR);
  if (day === today) return en ? `${hours} h ago` : `hace ${hours} h`;
  if (day === addDays(today, -1))
    return en ? `yesterday at ${time}` : `ayer a las ${time}`;
  if (day.slice(0, 4) === today.slice(0, 4)) {
    const short = shortDay(instant, timeZone, false, locale);
    return en ? `${short} at ${time}` : `${short} a las ${time}`;
  }
  return shortDay(instant, timeZone, true, locale);
}

/** "lunes, 2 de noviembre de 2026, 18:30": the accessible full date (RF-2). */
export function fullDateTime(
  instant: string,
  timeZone: string,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const date = dateFormat(locale, { dateStyle: "full", timeZone }).format(
    new Date(instant),
  );
  return `${date}, ${formatTime(instant, timeZone)}`;
}
