import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { TimeZoneField } from "@/components/calendar/time-zone-field";
import { RECENT_ZONES_KEY } from "@/lib/calendar/event-zone";

// Spec 045, T4 (RF-1, RF-2, RF-6).
function hidden(name: string) {
  return document.querySelector<HTMLInputElement>(`input[name="${name}"]`)!;
}

afterEach(() => localStorage.clear());

describe("TimeZoneField", () => {
  it("starts folded in the profile's zone and sends no zone (RF-6)", () => {
    render(
      <TimeZoneField
        profileZone="Europe/Madrid"
        initialStart=""
        initialEnd=""
      />,
    );
    expect(screen.getByText(/En tu zona/)).toHaveTextContent(
      "En tu zona (Madrid, Europe/Madrid)",
    );
    expect(hidden("startTz").value).toBe("");
    expect(hidden("endTz").value).toBe("");
  });

  it("sends the zone chosen and remembers it on this device (RF-1, D3)", async () => {
    render(
      <TimeZoneField
        profileZone="Europe/Madrid"
        initialStart=""
        initialEnd=""
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Cambiar zona horaria" }),
    );
    const input = screen.getByLabelText("Zona horaria");
    await userEvent.clear(input);
    await userEvent.type(input, "America/New_York");
    expect(hidden("startTz").value).toBe("America/New_York");
    expect(hidden("endTz").value).toBe("America/New_York");
    // The search box is never sent with the form.
    expect(input).toHaveAttribute("form", "none");
    await userEvent.tab();
    expect(JSON.parse(localStorage.getItem(RECENT_ZONES_KEY)!)).toEqual([
      "America/New_York",
    ]);
  });

  it("explains a zone that is not in the list", async () => {
    render(
      <TimeZoneField
        profileZone="Europe/Madrid"
        initialStart=""
        initialEnd=""
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Cambiar zona horaria" }),
    );
    const input = screen.getByLabelText("Zona horaria");
    await userEvent.clear(input);
    await userEvent.type(input, "Marte");
    await userEvent.tab();
    expect(screen.getByText("Elige una zona de la lista.")).toBeVisible();
    expect(hidden("startTz").value).toBe("");
  });

  it("opens with the event's zones and splits start and end (RF-2)", async () => {
    render(
      <TimeZoneField
        profileZone="Europe/Madrid"
        initialStart="Europe/Madrid"
        initialEnd="Asia/Kolkata"
      />,
    );
    expect(screen.getByLabelText("Zona de inicio")).toHaveValue(
      "Europe/Madrid",
    );
    expect(screen.getByLabelText("Zona de fin")).toHaveValue("Asia/Kolkata");
    expect(hidden("startTz").value).toBe("Europe/Madrid");
    expect(hidden("endTz").value).toBe("Asia/Kolkata");

    await userEvent.click(
      screen.getByRole("checkbox", { name: "Inicio y fin en zonas distintas" }),
    );
    // Back to one zone: the profile's, so nothing is sent.
    expect(hidden("endTz").value).toBe("");
  });
});
