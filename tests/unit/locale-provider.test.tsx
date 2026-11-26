import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BrowserLocale,
  LocaleProvider,
  T,
  useLocale,
  useT,
} from "@/components/i18n/locale-provider";

// Spec 053 T2: the language of a subtree (plan D8, D9; RF-6).
vi.mock("@/i18n/en", () => ({ EN: { Guardar: "Save" } }));

function Probe() {
  const t = useT();
  return (
    <p>
      {t("Guardar")} · {useLocale()} · <T>{"Guardar"}</T>
    </p>
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  document.cookie = "cafam-locale=; max-age=0; path=/";
  document.documentElement.lang = "es";
});

describe("LocaleProvider", () => {
  it("is Spanish without a provider", () => {
    render(<Probe />);
    expect(screen.getByText("Guardar · es · Guardar")).toBeInTheDocument();
  });

  it("translates with the catalog it gets and sets <html lang>", () => {
    render(
      <LocaleProvider locale="en" messages={{ Guardar: "Save" }}>
        <Probe />
      </LocaleProvider>,
    );
    expect(screen.getByText("Save · en · Save")).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("en");
  });

  it("ignores a catalog for Spanish", () => {
    render(
      <LocaleProvider locale="es" messages={{ Guardar: "Save" }}>
        <Probe />
      </LocaleProvider>,
    );
    expect(screen.getByText("Guardar · es · Guardar")).toBeInTheDocument();
  });
});

describe("BrowserLocale (RF-2)", () => {
  it("stays Spanish and loads nothing for a Spanish browser", async () => {
    vi.spyOn(navigator, "languages", "get").mockReturnValue(["es-ES", "en"]);
    render(
      <BrowserLocale>
        <Probe />
      </BrowserLocale>,
    );
    await act(async () => {});
    expect(screen.getByText("Guardar · es · Guardar")).toBeInTheDocument();
  });

  it("loads English when the cookie says so", async () => {
    document.cookie = "cafam-locale=en; path=/";
    render(
      <BrowserLocale>
        <Probe />
      </BrowserLocale>,
    );
    expect(await screen.findByText("Save · en · Save")).toBeInTheDocument();
  });
});
