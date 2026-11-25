import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  TimeZoneCheck,
  zoneNotice,
} from "@/components/account/time-zone-check";
import { ToastProvider } from "@/components/ui/toast";

// Spec 050, T4: a new account made with Google checks its zone on its first
// entry (RF-4).
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

afterEach(() => window.history.replaceState(null, "", "/"));

describe("zoneNotice", () => {
  it("speaks only when the zone differs from the browser's", () => {
    expect(zoneNotice("Europe/Madrid", "America/Bogota")).toBe(
      "Hemos puesto tu zona en Europe/Madrid. ¿Es correcta?",
    );
    expect(zoneNotice("Europe/Madrid", "Europe/Madrid")).toBeNull();
    expect(zoneNotice(null, "Europe/Madrid")).toBeNull();
  });
});

describe("TimeZoneCheck", () => {
  it("reads ?tzcheck once and removes it from the URL", () => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const other = zone === "Pacific/Fiji" ? "Asia/Tokyo" : "Pacific/Fiji";
    window.history.replaceState(
      null,
      "",
      `/dashboard/calendar?tzcheck=${encodeURIComponent(other)}`,
    );
    render(
      <ToastProvider>
        <TimeZoneCheck />
      </ToastProvider>,
    );
    expect(
      screen.getByText(`Hemos puesto tu zona en ${other}. ¿Es correcta?`),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cambiar" })).toBeInTheDocument();
    expect(window.location.search).toBe("");
  });

  it("says nothing when the zone is the browser's", () => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    window.history.replaceState(null, "", `/x?tzcheck=${zone}`);
    render(
      <ToastProvider>
        <TimeZoneCheck />
      </ToastProvider>,
    );
    expect(screen.queryByText(/Hemos puesto tu zona/)).not.toBeInTheDocument();
  });
});
