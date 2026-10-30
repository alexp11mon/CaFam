// Row of months under the header of the month view (spec 016 RF-20..RF-22).

export type MonthStripItem =
  | { kind: "month"; key: string; label: string; current: boolean }
  | { kind: "year"; label: string };

const shortMonth = new Intl.DateTimeFormat("es-ES", {
  month: "short",
  timeZone: "UTC",
});

const MONTHS_BEFORE = 12;
const MONTHS_AFTER = 24;

/** From a year before to two after `month` (YYYY-MM), with the year between December and January. */
export function monthStrip(month: string): MonthStripItem[] {
  const [year, value] = month.split("-").map(Number) as [number, number];
  const base = year * 12 + value - 1;
  const items: MonthStripItem[] = [];
  for (
    let index = base - MONTHS_BEFORE;
    index <= base + MONTHS_AFTER;
    index++
  ) {
    const y = Math.floor(index / 12);
    const m = (index % 12) + 1;
    if (m === 1 && items.length > 0)
      items.push({ kind: "year", label: String(y) });
    const key = `${y}-${String(m).padStart(2, "0")}`;
    items.push({
      kind: "month",
      key,
      label: shortMonth
        .format(new Date(`${key}-01T00:00:00Z`))
        .replace(".", ""),
      current: index === base,
    });
  }
  return items;
}
