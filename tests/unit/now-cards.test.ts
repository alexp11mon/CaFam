import { describe, expect, it } from "vitest";
import type { BusyInput } from "@/lib/availability/busy";
import {
  buildNowCards,
  type NowEventInput,
  type NowInput,
} from "@/lib/now/cards";

// Spec 054 T2: who "Ahora" shows and what it says of each (RF-2 to RF-15, RF-22).
const ME = "me";
const SON = "son";
const DAD = "dad";
const AUNT = "aunt";
const ZONE = "Europe/Madrid";
// 2026-11-27 12:00 in Madrid.
const NOW = Date.parse("2026-11-27T11:00:00Z");

const at = (time: string, day = "27") => `2026-11-${day}T${time}:00.000Z`;

let nextId = 0;
const event = (
  calendarId: string,
  start: string,
  end: string,
  more: Partial<NowEventInput> = {},
): NowEventInput => ({
  id: `e${(nextId += 1)}`,
  calendarId,
  title: `Evento ${nextId}`,
  startsAt: start,
  endsAt: end,
  allDay: false,
  location: null,
  ...more,
});

const busy = (personId: string, start: string, end: string): BusyInput => ({
  personId,
  startsAt: start,
  endsAt: end,
  allDay: false,
});

function input(more: Partial<NowInput> = {}): NowInput {
  return {
    userId: ME,
    timeZone: ZONE,
    calendars: [
      { id: "mine", name: "Mío", ownerId: ME, color: "#111111" },
      { id: "school", name: "Cole", ownerId: SON, color: "#222222" },
      { id: "football", name: "Fútbol", ownerId: SON, color: "#333333" },
      { id: "dad", name: "Papá", ownerId: DAD, color: "#444444" },
    ],
    people: [
      { id: ME, displayName: "Yo" },
      { id: SON, displayName: "Hugo" },
      { id: DAD, displayName: "Luis" },
      { id: AUNT, displayName: "Marta" },
    ],
    preferences: { calendarPreferences: [], personPreferences: [] },
    events: [],
    busy: [],
    busyPeople: [],
    ...more,
  };
}

const cardOf = (cards: ReturnType<typeof buildNowCards>, id: string) =>
  cards.find((card) => card.person.id === id)!;

describe("who is followed and in what order (RF-2 to RF-5)", () => {
  it("shows me first, then the owners of visible calendars in the saved order", () => {
    const cards = buildNowCards(
      input({
        preferences: {
          calendarPreferences: [],
          personPreferences: [
            { personId: DAD, position: 0 },
            { personId: SON, position: 1 },
          ],
        },
      }),
      NOW,
    );
    expect(cards.map((card) => card.person.id)).toEqual([ME, DAD, SON]);
    expect(cards[0]!.person).toMatchObject({ isMe: true, name: "Yo" });
  });

  it("leaves out whoever has every calendar hidden, unless marked in Disponibilidad", () => {
    const hidden = {
      calendarPreferences: [
        { calendarId: "dad", visible: false, position: null },
      ],
      personPreferences: [],
    };
    expect(
      buildNowCards(input({ preferences: hidden }), NOW).map(
        (c) => c.person.id,
      ),
    ).toEqual([ME, SON]);

    const cards = buildNowCards(
      input({
        preferences: hidden,
        busyPeople: [
          { id: DAD, name: "Luis", shown: true },
          { id: AUNT, name: "Marta", shown: true },
          { id: "other", name: "Otro", shown: false },
        ],
      }),
      NOW,
    );
    expect(cards.map((card) => card.person.id)).toEqual([ME, SON, DAD, AUNT]);
  });

  it("always shows me, even with nothing visible", () => {
    const cards = buildNowCards(
      input({
        calendars: [],
        preferences: { calendarPreferences: [], personPreferences: [] },
      }),
      NOW,
    );
    expect(cards.map((card) => card.person.id)).toEqual([ME]);
  });
});

describe("events of a card (RF-6 to RF-12)", () => {
  it("only takes events of that person's visible calendars, also inside a group", () => {
    const cards = buildNowCards(
      input({
        preferences: {
          calendarPreferences: [
            { calendarId: "football", visible: false, position: null },
            { calendarId: "school", visible: true, position: 0, groupId: "g" },
          ],
          personPreferences: [],
        },
        events: [
          event("school", at("10:00"), at("12:00"), { title: "Mates" }),
          event("football", at("10:00"), at("12:00"), { title: "Oculto" }),
        ],
      }),
      NOW,
    );
    const son = cardOf(cards, SON);
    expect(son.current).toMatchObject({ kind: "event", more: 0 });
    expect(
      son.current.kind === "event" && son.current.events.map((e) => e.title),
    ).toEqual(["Mates"]);
    expect(cardOf(cards, ME).current).toEqual({ kind: "free", until: null });
  });

  it("gives title, calendar, place and end of what is on now; the end is exclusive", () => {
    const cards = buildNowCards(
      input({
        events: [
          event("school", at("09:00"), at("11:00"), { title: "Acabado" }),
          event("school", at("10:30"), at("12:00"), {
            title: "Mates",
            location: "Aula 3",
          }),
        ],
      }),
      NOW,
    );
    const son = cardOf(cards, SON).current;
    expect(son.kind === "event" && son.events).toEqual([
      expect.objectContaining({
        title: "Mates",
        calendarName: "Cole",
        location: "Aula 3",
        endsAt: at("12:00"),
      }),
    ]);
  });

  it("shows the two that started last and +N more (RF-8)", () => {
    const cards = buildNowCards(
      input({
        events: [
          event("school", at("08:00"), at("13:00"), { title: "A" }),
          event("school", at("09:00"), at("13:00"), { title: "B" }),
          event("football", at("10:00"), at("13:00"), { title: "C" }),
          event("school", at("10:30"), at("13:00"), { title: "D" }),
        ],
      }),
      NOW,
    );
    const son = cardOf(cards, SON).current;
    expect(son.kind).toBe("event");
    if (son.kind !== "event") return;
    expect(son.events.map((e) => e.title)).toEqual(["D", "C"]);
    expect(son.more).toBe(2);
  });

  it("is free until the next event of today, and gives what comes after (RF-9, RF-10)", () => {
    const cards = buildNowCards(
      input({
        events: [
          event("school", at("15:00"), at("16:00"), { title: "Inglés" }),
          event("school", at("17:00"), at("18:00"), { title: "Piano" }),
        ],
      }),
      NOW,
    );
    const son = cardOf(cards, SON);
    expect(son.current).toEqual({ kind: "free", until: at("15:00") });
    expect(son.next).toMatchObject({ title: "Inglés", startsAt: at("15:00") });
  });

  it("is free with no end when the next is tomorrow, and nothing past tomorrow (RF-9 to RF-11)", () => {
    const tomorrow = buildNowCards(
      input({
        events: [event("school", at("08:00", "28"), at("09:00", "28"))],
      }),
      NOW,
    );
    expect(cardOf(tomorrow, SON).current).toEqual({
      kind: "free",
      until: null,
    });
    expect(cardOf(tomorrow, SON).next).toMatchObject({
      startsAt: at("08:00", "28"),
    });

    // 2026-11-29 00:30 in Madrid is past the end of tomorrow.
    const later = buildNowCards(
      input({
        events: [event("school", at("23:30", "28"), at("23:45", "28"))],
      }),
      NOW,
    );
    expect(cardOf(later, SON).next).toBeNull();
  });

  it("keeps all-day events of today apart, not as on now (RF-12)", () => {
    const cards = buildNowCards(
      input({
        events: [
          event("school", at("00:00", "27"), at("00:00", "28"), {
            title: "Excursión",
            allDay: true,
          }),
          event("school", at("00:00", "28"), at("00:00", "29"), {
            title: "Mañana",
            allDay: true,
          }),
        ],
      }),
      NOW,
    );
    const son = cardOf(cards, SON);
    expect(son.today.map((e) => e.title)).toEqual(["Excursión"]);
    expect(son.current).toEqual({ kind: "free", until: null });
    expect(son.next).toBeNull();
  });

  it("covers the limit cases of the spec", () => {
    const cards = buildNowCards(
      input({
        events: [
          // Started yesterday and still on (crosses midnight).
          event("school", at("20:00", "26"), at("13:00"), { title: "Noche" }),
          // Zero minutes: never on, can be next.
          event("dad", at("12:00"), at("12:00"), { title: "Cero" }),
          // A moved repetition of a series is an event like any other.
          event("dad", at("12:30"), at("13:00"), {
            title: "Movida",
            id: "series_20261127T090000Z",
          }),
        ],
      }),
      NOW,
    );
    expect(cardOf(cards, SON).current).toMatchObject({ kind: "event" });
    const dad = cardOf(cards, DAD);
    expect(dad.current).toEqual({ kind: "free", until: at("12:00") });
    expect(dad.next).toMatchObject({ title: "Cero" });
  });
});

describe("people seen through availability (RF-13, RF-14, RF-22)", () => {
  const marked = [
    { id: AUNT, name: "Marta", shown: true },
    { id: SON, name: "Hugo", shown: true },
  ];

  it("says only busy or free until, with no title (RF-13)", () => {
    const busyNow = buildNowCards(
      input({
        busyPeople: marked,
        busy: [
          busy(AUNT, at("10:00"), at("11:30")),
          busy(AUNT, at("11:30"), at("13:00")),
        ],
      }),
      NOW,
    );
    const aunt = cardOf(busyNow, AUNT);
    expect(aunt.busyOnly).toBe(true);
    expect(aunt.current).toEqual({ kind: "busy", until: at("13:00") });
    expect(aunt.next).toBeNull();
    expect(aunt.today).toEqual([]);

    const freeNow = buildNowCards(
      input({
        busyPeople: marked,
        busy: [busy(AUNT, at("16:00"), at("17:00"))],
      }),
      NOW,
    );
    expect(cardOf(freeNow, AUNT).current).toEqual({
      kind: "free",
      until: at("16:00"),
    });
  });

  it("mixes visible events and busy times of the same person (RF-14)", () => {
    const shown = event("school", at("16:00"), at("17:00"), {
      title: "Inglés",
    });
    const cards = buildNowCards(
      input({
        busyPeople: marked,
        events: [shown],
        busy: [
          busy(SON, at("10:00"), at("12:30")),
          // The same as a visible event: not counted twice.
          busy(SON, shown.startsAt, shown.endsAt),
        ],
      }),
      NOW,
    );
    const son = cardOf(cards, SON);
    expect(son.busyOnly).toBe(false);
    expect(son.current).toEqual({ kind: "busy", until: at("12:30") });
    expect(son.next).toMatchObject({ title: "Inglés" });
  });

  it("has no data without connection (RF-22)", () => {
    const cards = buildNowCards(
      input({
        busyPeople: marked,
        busy: null,
        events: [event("school", at("16:00"), at("17:00"))],
      }),
      NOW,
    );
    expect(cardOf(cards, AUNT).current).toEqual({ kind: "noData" });
    expect(cardOf(cards, SON).current).toEqual({
      kind: "free",
      until: at("16:00"),
    });
  });
});

describe("time zones (RF-15)", () => {
  it("decides today and tomorrow in the profile's zone", () => {
    // 2026-11-27 20:00 in New York is already the 28th in UTC.
    const cards = buildNowCards(
      input({
        timeZone: "America/New_York",
        events: [
          event("school", at("00:00", "27"), at("00:00", "28"), {
            title: "Hoy",
            allDay: true,
          }),
          event("school", at("02:00", "28"), at("03:00", "28")),
        ],
      }),
      Date.parse("2026-11-28T01:00:00Z"),
    );
    const son = cardOf(cards, SON);
    expect(son.today.map((e) => e.title)).toEqual(["Hoy"]);
    // 21:00 in New York: still today.
    expect(son.current).toEqual({ kind: "free", until: at("02:00", "28") });
  });
});
