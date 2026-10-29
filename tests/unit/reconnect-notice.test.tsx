import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReconnectNotice } from "@/components/connections/reconnect-notice";
import { CalendarPicker } from "@/components/connections/calendar-picker";
import { missingFromQuery } from "@/lib/sync/scopes";

// Spec 009, T9: read-only accounts and calendars (RF-3, RF-5, RF-8).
describe("ReconnectNotice (RF-3)", () => {
  it("asks the owner to connect again to edit", () => {
    render(<ReconnectNotice email="ana@gmail.com" />);

    expect(screen.getByText(/ana@gmail.com/)).toBeInTheDocument();
    expect(screen.getByText(/solo puede leer/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Volver a conectar" }),
    ).toHaveAttribute("href", "/dashboard/connections/new?provider=google");
  });

  it("names the permissions that were not granted (RF-5)", () => {
    render(
      <ReconnectNotice
        email="ana@gmail.com"
        missing={missingFromQuery("calendar.events,calendar.calendars")}
      />,
    );

    expect(
      screen.getByText(/ver y editar los eventos de tus calendarios/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/crear calendarios y cambiar su nombre/),
    ).toBeInTheDocument();
  });

  it("ignores unknown permission names in the address", () => {
    expect(missingFromQuery("calendar.events,bogus")).toEqual([
      "https://www.googleapis.com/auth/calendar.events",
    ]);
    expect(missingFromQuery(undefined)).toEqual([]);
  });
});

describe("CalendarPicker with read-only calendars (RF-8)", () => {
  it("marks the calendars the account can only read in Google", () => {
    render(
      <CalendarPicker
        connectionId="c1"
        action={async () => ({})}
        calendars={[
          {
            id: "a",
            name: "Casa",
            color: null,
            synced: false,
            access: "owner",
          },
          {
            id: "b",
            name: "Festivos",
            color: null,
            synced: false,
            access: "reader",
          },
        ]}
      />,
    );

    expect(screen.getByText("Solo lectura en Google")).toBeInTheDocument();
    expect(screen.getAllByText("Solo lectura en Google")).toHaveLength(1);
  });
});
