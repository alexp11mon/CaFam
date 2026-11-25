import { describe, expect, it } from "vitest";
import { shareText } from "@/lib/share/text";

const base = {
  title: "Cena con Ana",
  startsAt: "2026-11-20T20:00:00Z",
  endsAt: "2026-11-20T22:00:00Z",
  allDay: false,
};

describe("shareText (spec 047 RF-1)", () => {
  it("joins title, when and place", () => {
    expect(
      shareText({ ...base, location: "Casa de Ana" }, "Europe/Madrid"),
    ).toBe(
      "Cena con Ana · viernes, 20 de noviembre de 2026, 21:00 – 23:00 · Casa de Ana",
    );
  });

  it("leaves out an empty place", () => {
    expect(shareText({ ...base, location: "  " }, "Europe/Madrid")).toBe(
      "Cena con Ana · viernes, 20 de noviembre de 2026, 21:00 – 23:00",
    );
  });

  it("writes an all-day event as dates, whatever the zone", () => {
    expect(
      shareText(
        {
          title: "Puente",
          startsAt: "2026-12-07T00:00:00Z",
          endsAt: "2026-12-09T00:00:00Z",
          allDay: true,
          location: null,
        },
        "America/New_York",
      ),
    ).toBe(
      "Puente · lunes, 7 de diciembre de 2026 – martes, 8 de diciembre de 2026",
    );
  });
});
