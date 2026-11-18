import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PushSupport } from "@/lib/push/device";

// Spec 040, T6: "Notificaciones" in Ajustes (RF-1 to RF-4, RF-6, RF-14).
const browser = vi.hoisted(() => ({
  support: "ready" as PushSupport,
  endpoint: null as string | null,
  subscribeDevice: vi.fn(),
}));

vi.mock("@/lib/push/browser", () => ({
  useBrowserSupport: () => browser.support,
  currentEndpoint: async () => browser.endpoint,
  subscribeDevice: browser.subscribeDevice,
}));

import {
  NotificationSettings,
  type NotificationActions,
} from "@/components/settings/notification-settings";

const NOTIFY = { joined: true, access: true, comments: true, changes: false };

function actions(): NotificationActions {
  return {
    save: vi.fn(async () => ({})),
    remove: vi.fn(async () => ({})),
    test: vi.fn(async () => ({})),
    setNotify: vi.fn(async () => ({})),
    setDefaults: vi.fn(async () => ({})),
  };
}

function setup(
  devices = [] as { id: string; device: string; endpoint: string }[],
) {
  const acts = actions();
  render(
    <NotificationSettings
      publicKey="BPublic"
      devices={devices}
      defaults={{ timed: 10, allDay: 1440 }}
      notify={NOTIFY}
      actions={acts}
    />,
  );
  return acts;
}

beforeEach(() => {
  browser.support = "ready";
  browser.endpoint = null;
  browser.subscribeDevice.mockReset();
});

describe("NotificationSettings", () => {
  it("asks permission only after pressing and saves the device", async () => {
    const user = userEvent.setup();
    browser.subscribeDevice.mockResolvedValue({
      endpoint: "https://push.test/1",
      p256dh: "k",
      auth: "a",
      device: "Chrome en Windows",
    });
    const acts = setup();
    expect(browser.subscribeDevice).not.toHaveBeenCalled();
    expect(screen.getByText("Ningún dispositivo recibe avisos.")).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "Activar en este dispositivo" }),
    );
    expect(browser.subscribeDevice).toHaveBeenCalledWith("BPublic");
    await waitFor(() =>
      expect(acts.save).toHaveBeenCalledWith(
        expect.objectContaining({ endpoint: "https://push.test/1" }),
      ),
    );
  });

  it("lists the devices with Quitar and sends a test to this one", async () => {
    const user = userEvent.setup();
    browser.endpoint = "https://push.test/mine";
    const acts = setup([
      {
        id: "d1",
        device: "Chrome en Windows",
        endpoint: "https://push.test/mine",
      },
      { id: "d2", device: "Safari en iPhone", endpoint: "https://push.test/2" },
    ]);
    expect(
      await screen.findByText("Este dispositivo recibe avisos."),
    ).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "Enviar un aviso de prueba" }),
    );
    expect(acts.test).toHaveBeenCalledWith("https://push.test/mine");
    await user.click(
      screen.getByRole("button", { name: "Quitar Safari en iPhone" }),
    );
    expect(acts.remove).toHaveBeenCalledWith("d2");
  });

  it("explains iOS outside the installed app and a blocked permission", () => {
    browser.support = "ios-install";
    setup();
    expect(
      screen.getByText(
        "En el iPhone los avisos solo funcionan con CaFam añadida a la pantalla de inicio.",
      ),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Activar en este dispositivo" }),
    ).toBeNull();
  });

  it("explains how to undo a blocked permission", () => {
    browser.support = "denied";
    setup();
    expect(screen.getByText(/Has bloqueado los avisos/)).toBeVisible();
  });

  it("saves the default reminders and the kinds of notice", async () => {
    const user = userEvent.setup();
    const acts = setup();
    await user.selectOptions(screen.getByLabelText("Eventos con hora"), "none");
    expect(acts.setDefaults).toHaveBeenCalledWith({
      timed: null,
      allDay: 1440,
    });
    await user.click(
      screen.getByRole("switch", {
        name: "Cambian o borran un evento que he creado",
      }),
    );
    await waitFor(() =>
      expect(acts.setNotify).toHaveBeenCalledWith({ ...NOTIFY, changes: true }),
    );
  });
});
