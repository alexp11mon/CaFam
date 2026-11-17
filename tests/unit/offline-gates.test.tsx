import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NavLink } from "@/components/shell/nav-link";
import { resetConnection, startWatching } from "@/lib/offline/connection";
import { allowedScopes, navReason, networkReason } from "@/lib/offline/gates";
import { NAV_ITEMS } from "@/lib/shell/nav";
import {
  readOnlyEventText,
  readOnlyPasteText,
  readOnlyReason,
} from "@/lib/sync/read-only";

// Spec 034 T10: what works without a connection (RF-17, RF-23 to RF-25,
// RF-35, plan D15).
vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));

const item = (section: string) =>
  NAV_ITEMS.find((entry) => entry.section === section)!;

afterEach(() => resetConnection());

describe("gates", () => {
  it("disables the destinations that need the network, offline only (RF-17)", () => {
    for (const section of [
      "calendars",
      "assistant",
      "connections",
      "join",
      "import",
      "settings",
    ]) {
      expect(navReason(item(section), false)).toBe("Necesita conexión");
      expect(navReason(item(section), true)).toBeNull();
    }
    expect(navReason(item("calendar"), false)).toBeNull();
    expect(navReason(item("notes"), false)).toBeNull();
  });

  it("leaves only 'Solo este evento' offline (RF-23)", () => {
    expect(allowedScopes(false)).toEqual(["this"]);
    expect(allowedScopes(true)).toEqual(["this", "following", "all"]);
  });

  it("gives the reason for series and moving notes offline (RF-24, RF-35)", () => {
    expect(networkReason(false)).toBe("Necesita conexión");
    expect(networkReason(true)).toBeNull();
  });
});

describe("readOnlyReason without a connection (RF-25)", () => {
  const synced = {
    lastSyncedAt: null,
    accountEmail: null,
    connectionId: "c",
    canWrite: true,
    googleAccess: null,
    provider: "icloud" as const,
  };

  it("makes every synced calendar read-only, and no other", () => {
    expect(readOnlyReason(synced, false)).toBe("offline");
    expect(readOnlyReason(null, false)).toBeNull();
    expect(readOnlyReason(synced, true)).toBeNull();
  });

  it("names the provider in the reason", () => {
    expect(readOnlyEventText("offline", "google")).toBe(
      "Sin conexión no se puede escribir en Google",
    );
    expect(readOnlyPasteText("offline", "icloud")).toBe(
      "Sin conexión no se puede escribir en iCloud",
    );
  });
});

describe("NavLink", () => {
  it("is a link with the network and disabled with its reason without it", () => {
    const { rerender } = render(
      <NavLink item={item("settings")} className="row">
        Ajustes
      </NavLink>,
    );
    expect(screen.getByRole("link", { name: "Ajustes" })).toHaveAttribute(
      "href",
      "/dashboard/settings",
    );

    startWatching();
    window.dispatchEvent(new Event("offline"));
    rerender(
      <NavLink item={item("settings")} className="row" showReason>
        Ajustes
      </NavLink>,
    );
    const disabled = screen.getByRole("link", {
      name: "Ajustes: Necesita conexión",
    });
    expect(disabled).toHaveAttribute("aria-disabled", "true");
    expect(disabled).not.toHaveAttribute("href");
  });
});
