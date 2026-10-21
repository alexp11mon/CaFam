import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ImportSummary } from "@/components/import/import-summary";

const ID = "11111111-1111-4111-8111-111111111111";

describe("ImportSummary (RF-31)", () => {
  it("shows the created events and offers to open the calendar", () => {
    render(
      <ImportSummary
        result={{ calendarId: ID, created: 42, skipped: 0, cutSeries: 0 }}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Calendario creado con 42 eventos.",
    );
    expect(
      screen.getByRole("link", { name: "Abrir calendario" }),
    ).toHaveAttribute("href", "/dashboard/calendar");
    expect(
      screen.getByRole("link", { name: "Editar calendario" }),
    ).toHaveAttribute("href", `/dashboard/calendars/${ID}/edit`);
  });

  it("uses the singular for one event", () => {
    render(
      <ImportSummary
        result={{ calendarId: ID, created: 1, skipped: 0, cutSeries: 0 }}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Calendario creado con 1 evento.",
    );
  });

  it("does not mention skipped events or cut series when there are none", () => {
    render(
      <ImportSummary
        result={{ calendarId: ID, created: 5, skipped: 0, cutSeries: 0 }}
      />,
    );

    expect(screen.getByRole("status")).not.toHaveTextContent(/omit/i);
    expect(screen.getByRole("status")).not.toHaveTextContent(/serie/i);
  });

  it("says how many events were skipped", () => {
    render(
      <ImportSummary
        result={{ calendarId: ID, created: 5, skipped: 3, cutSeries: 0 }}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "3 eventos se han omitido",
    );
  });

  it("says how many series were cut to one year", () => {
    render(
      <ImportSummary
        result={{ calendarId: ID, created: 5, skipped: 1, cutSeries: 2 }}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "1 evento se ha omitido",
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "2 series sin fin se han cortado a un año desde hoy",
    );
  });
});
