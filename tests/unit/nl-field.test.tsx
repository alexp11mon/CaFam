import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NlField } from "@/components/calendar/nl-field";

// Spec 041 T5: the phrase field on its own (RF-11, RF-12, RNF-3).
function setup() {
  const onApply = vi.fn();
  render(
    <form onSubmit={(event) => event.preventDefault()}>
      <NlField
        timeZone="Europe/Madrid"
        defaultMinutes={60}
        calendars={[{ id: "fam", name: "Familia" }]}
        fallback={{ date: "2026-12-01", startTime: "09:00" }}
        onApply={onApply}
        autoFocus
      />
    </form>,
  );
  return { onApply, field: screen.getByLabelText("Escribe el evento") };
}

describe("NlField", () => {
  it("starts empty, focused and with nothing to apply", () => {
    const { field } = setup();
    expect(field).toHaveFocus();
    expect(field).toHaveAttribute("placeholder");
    expect(screen.getByRole("button", { name: "Aplicar" })).toBeDisabled();
  });

  it("previews while typing and underlines what it understood", async () => {
    const user = userEvent.setup();
    const { field } = setup();
    await user.type(field, "Pádel el 5 de diciembre de 2026 a las 19");

    expect(
      screen.getByText("Pádel · Sábado, 5 de diciembre · 19:00–20:00"),
    ).toBeInTheDocument();
    const underlined = document.querySelectorAll("[aria-live] .underline");
    expect([...underlined].map((span) => span.textContent)).toEqual([
      "el 5 de diciembre de 2026",
      "a las 19",
    ]);
  });

  it("applies with the button or Intro, never submitting", async () => {
    const user = userEvent.setup();
    const submit = vi.fn();
    const { field, onApply } = setup();
    field.closest("form")!.addEventListener("submit", submit);
    await user.type(field, "Cine a las 9 de la noche @fam{Enter}");
    expect(submit).not.toHaveBeenCalled();
    expect(onApply).toHaveBeenLastCalledWith(
      expect.objectContaining({
        title: "Cine",
        startDate: "2026-12-01",
        startTime: "21:00",
        endTime: "22:00",
        calendarId: "fam",
      }),
    );
    await user.click(screen.getByRole("button", { name: "Aplicar" }));
    expect(onApply).toHaveBeenCalledTimes(2);
  });

  it("says when nothing is left for the title and clears with the text", async () => {
    const user = userEvent.setup();
    const { field } = setup();
    await user.type(field, "a las 5");
    expect(screen.getByText(/^Sin título · /)).toBeInTheDocument();
    expect(
      screen.getByText("Se entiende por la tarde: 17:00."),
    ).toBeInTheDocument();
    await user.clear(field);
    expect(screen.queryByText(/Sin título/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Aplicar" })).toBeDisabled();
  });
});
