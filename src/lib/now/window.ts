import { todayKey } from "@/lib/calendar/format";
import { daysRange, startOfDay } from "@/lib/calendar/ranges";
import { addDays } from "@/lib/calendar/time-zone";

// What "Ahora" reads and how far "Después" looks: today and tomorrow in the
// profile's zone (spec 054 RF-10, RF-11, plan D1).

export interface NowWindow {
  /** Today in the zone, YYYY-MM-DD. */
  day: string;
  /** Instants to read; they also cover all-day events at 00:00 UTC. */
  from: Date;
  to: Date;
  /** 00:00 of tomorrow and of the day after, in the zone. */
  todayEnd: Date;
  tomorrowEnd: Date;
}

export function nowWindow(now: number, timeZone: string): NowWindow {
  const day = todayKey(timeZone, new Date(now));
  const tomorrow = addDays(day, 1);
  return {
    day,
    ...daysRange(day, tomorrow, timeZone),
    todayEnd: startOfDay(tomorrow, timeZone),
    tomorrowEnd: startOfDay(addDays(day, 2), timeZone),
  };
}
