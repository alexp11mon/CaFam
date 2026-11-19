import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  FEED_WARNING,
  IcsFeedPanel,
  type FeedState,
} from "@/components/sharing/ics-feed-panel";
import type { ConfirmState } from "@/lib/forms/form-state";

// Spec 043 T4: the subscription link panel (RF-7, RF-8, RF-12).
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
  };
});

const URL = "https://cafam.test/api/ics/abc.ics";
const disable = vi.fn<() => Promise<ConfirmState>>(async () => ({}));

describe("IcsFeedPanel", () => {
  it("warns and offers to create a link when there is none", () => {
    render(
      <IcsFeedPanel
        active={false}
        createAction={async () => ({})}
        disableAction={disable}
      />,
    );
    expect(screen.getByText(FEED_WARNING)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Crear enlace" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Desactivar" })).toBeNull();
  });

  it("shows the new link once with Google and Apple", async () => {
    const create = vi.fn<() => Promise<FeedState>>(async () => ({ url: URL }));
    const { rerender } = render(
      <IcsFeedPanel
        active={false}
        createAction={create}
        disableAction={disable}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Crear enlace" }));
    // The server answers with the link already active.
    rerender(
      <IcsFeedPanel active createAction={create} disableAction={disable} />,
    );
    expect(
      await screen.findByRole("textbox", { name: "Enlace de suscripción" }),
    ).toHaveValue(URL);
    expect(
      screen.getByRole("link", { name: "Abrir en Google Calendar" }),
    ).toHaveAttribute(
      "href",
      `https://calendar.google.com/calendar/r?cid=${encodeURIComponent("webcal://cafam.test/api/ics/abc.ics")}`,
    );
    expect(
      screen.getByRole("link", { name: "Abrir en Apple Calendar" }),
    ).toHaveAttribute("href", "webcal://cafam.test/api/ics/abc.ics");
    expect(
      screen.getByRole("button", { name: "Copiar enlace" }),
    ).toBeInTheDocument();
  });

  it("with a link already made, offers a new one and disabling it", () => {
    render(
      <IcsFeedPanel
        active
        createAction={async () => ({})}
        disableAction={disable}
      />,
    );
    expect(screen.getByText(/no se puede volver a ver/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Crear uno nuevo" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Desactivar el enlace de suscripción",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
  });
});
