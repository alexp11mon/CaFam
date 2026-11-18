import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NavLink } from "@/components/shell/nav-link";
import { resetConnection, startWatching } from "@/lib/offline/connection";
import {
  canDeleteComment,
  canDeleteImage,
  canEditComment,
  canWriteOffline,
  navReason,
  networkReason,
  offlineMoveTargets,
  offlineReadOnly,
  seriesOffline,
} from "@/lib/offline/gates";
import { NAV_ITEMS } from "@/lib/shell/nav";
import { readOnlyReason } from "@/lib/sync/read-only";

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

  it("gives the reason for moving notes offline (RF-35)", () => {
    expect(networkReason(false)).toBe("Necesita conexión");
    expect(networkReason(true)).toBeNull();
  });
});

describe("readOnlyReason without a connection (spec 035 RF-1)", () => {
  it("is the same as with one: a writable synced calendar takes changes", () => {
    const synced = {
      lastSyncedAt: null,
      accountEmail: null,
      connectionId: "c",
      canWrite: true,
      googleAccess: null,
      provider: "icloud" as const,
    };
    expect(readOnlyReason(synced)).toBeNull();
    expect(readOnlyReason({ ...synced, canWrite: false })).toBe("reconnect");
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

// Spec 035 T2: the same rules as with a connection.
describe("gates of spec 035", () => {
  const synced = (connectionId: string, extra = {}) => ({
    lastSyncedAt: null,
    accountEmail: null,
    connectionId,
    canWrite: true,
    googleAccess: "owner" as const,
    provider: "google" as const,
    ...extra,
  });
  const google = { id: "g", role: "editor" as const, synced: synced("a") };
  const sameAccount = { id: "g2", role: "owner" as const, synced: synced("a") };
  const other = { id: "g3", role: "owner" as const, synced: synced("b") };
  const normal = { id: "n", role: "owner" as const, synced: null };

  it("writes synced calendars offline as owner or Editor (RF-1)", () => {
    expect(canWriteOffline(google)).toBe(true);
    expect(canWriteOffline({ ...google, role: "viewer" })).toBe(false);
    expect(offlineReadOnly(google)).toBeNull();
  });

  it("keeps the provider's read-only and an account without permission (RF-2)", () => {
    const reader = {
      ...google,
      synced: synced("a", { canWrite: false, googleAccess: "reader" }),
    };
    const reconnect = {
      ...google,
      synced: synced("a", { canWrite: false, googleAccess: "writer" }),
    };
    expect(canWriteOffline(reader)).toBe(false);
    expect(offlineReadOnly(reader)).toBe("provider");
    expect(offlineReadOnly(reconnect)).toBe("reconnect");
  });

  it("moves only within the same account (RF-3)", () => {
    expect(
      offlineMoveTargets(google, [google, sameAccount, other, normal]).map(
        (c) => c.id,
      ),
    ).toEqual(["g", "g2"]);
    expect(
      offlineMoveTargets(normal, [google, normal]).map((c) => c.id),
    ).toEqual(["n"]);
  });

  it("offers the three scopes and Repetir in normal calendars only (RF-10, RF-11, RF-16)", () => {
    expect(seriesOffline(normal)).toEqual({
      scopes: ["this", "following", "all"],
      repeat: true,
    });
    expect(seriesOffline(google)).toEqual({ scopes: ["this"], repeat: false });
  });

  it("lets the author edit a comment and the author or owner delete it (RF-23, RF-24)", () => {
    const mine = { authorId: "ana" };
    expect(canEditComment(mine, "ana")).toBe(true);
    expect(canEditComment(mine, "luis")).toBe(false);
    expect(canEditComment({ authorId: null }, "ana")).toBe(false);
    expect(canDeleteComment(mine, "luis", "editor")).toBe(false);
    expect(canDeleteComment(mine, "luis", "owner")).toBe(true);
    expect(canDeleteComment(mine, "ana", "viewer")).toBe(true);
  });

  it("lets who uploaded it, the owner and Editors delete an image (RF-36)", () => {
    const image = { uploadedBy: "ana" };
    expect(canDeleteImage(image, "ana", "viewer")).toBe(true);
    expect(canDeleteImage(image, "luis", "viewer")).toBe(false);
    expect(canDeleteImage(image, "luis", "editor")).toBe(true);
    expect(canDeleteImage(image, "luis", "owner")).toBe(true);
  });
});
