import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  admin,
  createTestUser,
  deleteTestMail,
  deleteTestUser,
  getOwnCalendarId,
  type TestUser,
} from "./helpers";

// Spec 053 T1: the language of each account (RF-1, RF-3, RF-7).
let ana: TestUser;
let ben: TestUser;

beforeAll(async () => {
  [ana, ben] = await Promise.all([
    createTestUser({ display_name: "Ana" }),
    createTestUser({ display_name: "Ben", locale: "en" }),
  ]);
});

afterAll(async () => {
  await Promise.all(
    [ana, ben].filter(Boolean).map((user) => deleteTestUser(user.id)),
  );
  await deleteTestMail();
});

const localeOf = async (user: TestUser) =>
  (
    await user.client
      .from("profiles")
      .select("locale")
      .eq("id", user.id)
      .single()
  ).data?.locale;

describe("profiles.locale", () => {
  it("is Spanish by default and English when signing up in English (RF-7)", async () => {
    expect(await localeOf(ana)).toBe("es");
    expect(await localeOf(ben)).toBe("en");
    const names = await Promise.all(
      [ana, ben].map(async (user) => {
        const { data } = await admin
          .from("calendars")
          .select("name")
          .eq("id", await getOwnCalendarId(user.id))
          .single();
        return data?.name;
      }),
    );
    expect(names).toEqual(["Mi calendario", "My calendar"]);
  });

  it("each user changes only their own, and only to a known language (RF-1)", async () => {
    const own = await ana.client
      .from("profiles")
      .update({ locale: "en" })
      .eq("id", ana.id)
      .select("id");
    expect(own.data).toHaveLength(1);
    expect(await localeOf(ana)).toBe("en");

    const other = await ana.client
      .from("profiles")
      .update({ locale: "es" })
      .eq("id", ben.id)
      .select("id");
    expect(other.data).toHaveLength(0);

    const bad = await ana.client
      .from("profiles")
      .update({ locale: "fr" })
      .eq("id", ana.id);
    expect(bad.error?.code).toBe("23514");
  });
});

describe("email_outbox in the recipient's language (RF-3)", () => {
  it("translates a transfer for an English recipient and keeps Spanish otherwise", async () => {
    await admin.from("email_outbox").insert([
      {
        to_email: ben.email,
        subject: "Ahora eres el propietario de «Casa»",
        body: "Ana te ha traspasado el calendario «Casa» en CaFam. Ahora eres su propietario: puedes editarlo, compartirlo y decidir quién entra.",
      },
      {
        to_email: "nobody@cafam.test",
        subject: "Tienes tu copia del calendario",
        body: "El calendario «Casa» ya es tuyo: tienes una copia completa en Mis calendarios. El original se ha eliminado.",
      },
    ]);
    const { data } = await admin
      .from("email_outbox")
      .select("to_email, subject, body, locale")
      .in("to_email", [ben.email, "nobody@cafam.test"])
      .order("to_email");
    const toBen = data?.find((row) => row.to_email === ben.email);
    const toNobody = data?.find((row) => row.to_email !== ben.email);
    expect(toBen).toMatchObject({
      subject: "You are now the owner of “Casa”",
      locale: "en",
    });
    expect(toBen?.body).toMatch(/^Ana has transferred the calendar “Casa”/);
    expect(toNobody).toMatchObject({
      subject: "Tienes tu copia del calendario",
      locale: "es",
    });
  });
});
