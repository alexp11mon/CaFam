import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ShareEventButton } from "@/components/calendar/share-event-button";

const event = {
  id: "8f0c3a52-4c1e-4f7a-9f10-7c3a5d1e2b40",
  title: "Cena con Ana",
  startsAt: "2026-11-20T20:00:00Z",
  endsAt: "2026-11-20T22:00:00Z",
  allDay: false,
  location: "Casa de Ana",
  description: null,
};
const TEXT =
  "Cena con Ana · viernes, 20 de noviembre de 2026, 21:00 – 23:00 · Casa de Ana";

function setNavigator(values: Record<string, unknown>) {
  for (const [key, value] of Object.entries(values))
    Object.defineProperty(navigator, key, { value, configurable: true });
}

afterEach(() => {
  for (const key of ["share", "canShare", "clipboard"])
    Reflect.deleteProperty(navigator, key);
});

describe("ShareEventButton (spec 047 RF-1 to RF-4)", () => {
  it("shares the text and the .ics when files can be shared", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    setNavigator({ share, canShare: () => true });
    render(<ShareEventButton event={event} timeZone="Europe/Madrid" />);
    await userEvent.click(screen.getByRole("button", { name: "Compartir" }));
    expect(share).toHaveBeenCalledTimes(1);
    const data = share.mock.calls[0][0] as ShareData;
    expect(data.text).toBe(TEXT);
    expect(data.files?.[0].name).toBe("cena-con-ana.ics");
    expect(data.files?.[0].type).toBe("text/calendar");
  });

  it("shares only the text when files cannot be shared", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    setNavigator({ share, canShare: () => false });
    render(<ShareEventButton event={event} timeZone="Europe/Madrid" />);
    await userEvent.click(screen.getByRole("button", { name: "Compartir" }));
    expect(share).toHaveBeenCalledWith({ title: "Cena con Ana", text: TEXT });
  });

  it("stays quiet when the person closes the system sheet", async () => {
    const share = vi
      .fn()
      .mockRejectedValue(new DOMException("cancel", "AbortError"));
    setNavigator({ share, canShare: () => false });
    render(<ShareEventButton event={event} timeZone="Europe/Madrid" />);
    await userEvent.click(screen.getByRole("button", { name: "Compartir" }));
    expect(screen.queryByRole("button", { name: "Copiar texto" })).toBeNull();
  });

  it("opens a menu without Web Share and copies text and link", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setNavigator({ clipboard: { writeText } });
    render(<ShareEventButton event={event} timeZone="Europe/Madrid" />);
    const open = screen.getByRole("button", { name: "Compartir" });
    await userEvent.click(open);
    expect(open).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByText(
        "El enlace solo funciona para quien ya comparte el calendario",
      ),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Copiar texto" }));
    expect(writeText).toHaveBeenLastCalledWith(TEXT);

    await userEvent.click(screen.getByRole("button", { name: "Compartir" }));
    await userEvent.click(
      screen.getByRole("button", { name: "Copiar enlace" }),
    );
    expect(writeText).toHaveBeenLastCalledWith(
      `${location.origin}/dashboard/events/${event.id}`,
    );
  });

  it("downloads the .ics from the menu", async () => {
    const createObjectURL = vi.fn(() => "blob:ics");
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    render(<ShareEventButton event={event} timeZone="Europe/Madrid" />);
    await userEvent.click(screen.getByRole("button", { name: "Compartir" }));
    await userEvent.click(
      screen.getByRole("button", { name: "Descargar .ics" }),
    );
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const anchor = click.mock.contexts[0] as HTMLAnchorElement;
    expect(anchor.download).toBe("cena-con-ana.ics");
    click.mockRestore();
  });
});
