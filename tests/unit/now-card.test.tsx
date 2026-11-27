import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LocaleProvider } from "@/components/i18n/locale-provider";
import { NowCard } from "@/components/now/now-card";
import { EN } from "@/i18n/en";
import type { NowCardData, NowEvent } from "@/lib/now/cards";

// Spec 054 T3: one card of "Ahora" (RF-7 to RF-18, plan D8).
const ZONE = "Europe/Madrid";
const DAY = "2026-11-27";

const ev = (id: string, title: string, more: Partial<NowEvent> = {}) => ({
  id,
  title,
  calendarName: "Cole",
  color: "#7c3aed",
  location: null,
  startsAt: "2026-11-27T10:00:00.000Z",
  endsAt: "2026-11-27T12:15:00.000Z",
  ...more,
});

const card = (more: Partial<NowCardData> = {}): NowCardData => ({
  person: { id: "son", name: "Hugo", isMe: false },
  busyOnly: false,
  today: [],
  current: {
    kind: "event",
    events: [ev("e1", "Mates", { location: "Aula 3" })],
    more: 0,
  },
  next: ev("e2", "Inglés", { startsAt: "2026-11-27T15:00:00.000Z" }),
  ...more,
});

const renderCard = (data: NowCardData) =>
  render(<NowCard card={data} day={DAY} timeZone={ZONE} />);

describe("NowCard", () => {
  it("is a region named after the person, with links and no actions (RF-16 to RF-18)", () => {
    renderCard(card());
    const region = screen.getByRole("region", { name: "Hugo" });
    expect(within(region).getByRole("link", { name: "Hugo" })).toHaveAttribute(
      "href",
      `/dashboard/calendar?view=day&date=${DAY}&only=son`,
    );
    expect(within(region).getByRole("link", { name: "Mates" })).toHaveAttribute(
      "href",
      "/dashboard/events/e1",
    );
    expect(
      within(region).getByRole("link", { name: "Inglés" }),
    ).toHaveAttribute("href", "/dashboard/events/e2");
    expect(within(region).queryByRole("button")).toBeNull();
  });

  it("shows what is on now with calendar, place and end, in the profile's zone (RF-7, RF-15)", () => {
    renderCard(card());
    expect(screen.getByText("Cole · Aula 3 · hasta las 13:15")).toBeVisible();
    expect(screen.getByText("16:00")).toHaveClass("tabular-nums");
  });

  it("says +N more (RF-8) and tomorrow's next (RF-10)", () => {
    renderCard(
      card({
        current: {
          kind: "event",
          events: [ev("a", "A"), ev("b", "B")],
          more: 3,
        },
        next: ev("n", "Piano", { startsAt: "2026-11-28T08:00:00.000Z" }),
      }),
    );
    expect(screen.getByText("+3 más")).toBeVisible();
    expect(screen.getByText("Mañana, 09:00")).toBeVisible();
  });

  it("shows free, busy, no data and nothing next (RF-9, RF-11, RF-13, RF-22)", () => {
    const { rerender } = renderCard(
      card({
        current: { kind: "free", until: "2026-11-27T14:00:00.000Z" },
        next: null,
      }),
    );
    expect(screen.getByText("Libre hasta las 15:00")).toBeVisible();
    expect(screen.getByText("Nada más hoy ni mañana")).toBeVisible();

    rerender(
      <NowCard
        card={card({
          busyOnly: true,
          current: { kind: "busy", until: "2026-11-27T13:00:00.000Z" },
          next: null,
        })}
        day={DAY}
        timeZone={ZONE}
      />,
    );
    expect(screen.getByText("Ocupado hasta las 14:00")).toBeVisible();
    expect(screen.queryByText("Después")).toBeNull();

    rerender(
      <NowCard
        card={card({ busyOnly: true, current: { kind: "noData" }, next: null })}
        day={DAY}
        timeZone={ZONE}
      />,
    );
    expect(screen.getByText("Sin datos sin conexión")).toBeVisible();
  });

  it("puts all-day events of today on a line apart (RF-12)", () => {
    renderCard(card({ today: [ev("d", "Excursión")] }));
    expect(screen.getByText("Hoy")).toBeVisible();
    expect(screen.getByRole("link", { name: "Excursión" })).toBeVisible();
  });

  it("announces only a change of kind, not of minute (D8)", () => {
    const { rerender } = renderCard(
      card({ current: { kind: "free", until: "2026-11-27T14:00:00.000Z" } }),
    );
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Hugo está libre");
    rerender(
      <NowCard
        card={card({
          current: { kind: "free", until: "2026-11-27T14:30:00.000Z" },
        })}
        day={DAY}
        timeZone={ZONE}
      />,
    );
    expect(status).toHaveTextContent("Hugo está libre");
    rerender(<NowCard card={card()} day={DAY} timeZone={ZONE} />);
    expect(status).toHaveTextContent("Hugo tiene algo ahora");
  });

  it("speaks English", () => {
    render(
      <LocaleProvider locale="en" messages={EN}>
        <NowCard
          card={card({
            person: { id: "me", name: "Ana", isMe: true },
            current: { kind: "free", until: null },
            next: null,
          })}
          day={DAY}
          timeZone={ZONE}
        />
      </LocaleProvider>,
    );
    expect(screen.getByRole("region", { name: "Ana (you)" })).toBeVisible();
    expect(screen.getByText("Free")).toBeVisible();
    expect(screen.getByText("Nothing else today or tomorrow")).toBeVisible();
  });
});
