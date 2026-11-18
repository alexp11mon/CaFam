import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SearchScreen, type SearchFn } from "@/components/search/search-screen";
import type { SearchResult } from "@/lib/search/queries";
import { addRecent } from "@/lib/search/recent";

// Spec 039, T4: the search screen (RF-2, RF-6 to RF-9, RF-12).
const router = vi.hoisted(() => ({ back: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const CALENDARS = [
  { id: "cal-1", name: "Familia", color: "#A0C4FF", hidden: false },
  { id: "cal-2", name: "Trabajo", color: "#FFADAD", hidden: true },
];

function result(id: string, extra: Partial<SearchResult> = {}): SearchResult {
  return {
    id,
    calendarId: "cal-1",
    title: "Dentista",
    startsAt: "2099-11-20T09:00:00Z",
    endsAt: "2099-11-20T10:00:00Z",
    allDay: false,
    color: null,
    categoryId: null,
    location: "Clínica",
    imageCount: 0,
    commentCount: 0,
    seriesId: null,
    matchedComment: null,
    ...extra,
  };
}

function setup(search: SearchFn, query = "") {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  render(
    <SearchScreen
      initialQuery={query}
      timeZone="Europe/Madrid"
      calendars={CALENDARS}
      search={search}
    />,
  );
  return {
    user,
    field: screen.getByRole("searchbox", { name: "Buscar eventos" }),
  };
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  router.back.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

describe("SearchScreen", () => {
  it("focuses the field and shows the last searches", async () => {
    addRecent("piano");
    const search = vi.fn<SearchFn>();
    const { user, field } = setup(search);
    expect(field).toHaveFocus();
    await user.click(await screen.findByRole("button", { name: "piano" }));
    expect(field).toHaveValue("piano");
  });

  it("searches 350 ms after the last key and from 2 characters", async () => {
    const search = vi.fn<SearchFn>(async () => ({
      results: [result("e1")],
      more: false,
    }));
    const { user, field } = setup(search);
    await user.type(field, "d");
    await act(() => vi.advanceTimersByTimeAsync(400));
    expect(search).not.toHaveBeenCalled();
    await user.type(field, "en");
    await act(() => vi.advanceTimersByTimeAsync(200));
    expect(search).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(200));
    expect(search).toHaveBeenCalledWith("den", 0);
    expect(await screen.findByRole("status")).toHaveTextContent("1 resultado");
  });

  it("groups by day, marks hidden calendars and shows the comment", async () => {
    const search = vi.fn<SearchFn>(async () => ({
      results: [
        result("e1"),
        result("e2", {
          calendarId: "cal-2",
          startsAt: "2000-01-05T09:00:00Z",
          endsAt: "2000-01-05T10:00:00Z",
          matchedComment: "Llevar la tarjeta del dentista",
        }),
      ],
      more: true,
    }));
    setup(search, "dentista");
    const upcoming = await screen.findByRole("region", { name: "Próximos" });
    expect(
      within(upcoming).getByRole("heading", {
        name: "Viernes, 20 de noviembre de 2099",
      }),
    ).toBeVisible();
    const past = screen.getByRole("region", { name: "Pasados" });
    expect(within(past).getByText("Oculto en el calendario")).toBeVisible();
    expect(
      within(past).getByText("dentista", { selector: "mark" }),
    ).toBeVisible();
    expect(
      screen.getByText("Hay más resultados: afina la búsqueda"),
    ).toBeVisible();
    expect(
      screen.getAllByRole("link", { name: /Dentista/ })[0],
    ).toHaveAttribute("href", "/dashboard/events/e1");
  });

  it("says when nothing matches and widens the period", async () => {
    const search = vi.fn<SearchFn>(async () => ({ results: [], more: false }));
    const { user } = setup(search, "nada");
    expect(await screen.findByText(/Prueba con otra palabra/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Buscar más atrás" }));
    await act(() => vi.advanceTimersByTimeAsync(400));
    expect(search).toHaveBeenLastCalledWith("nada", 1);
  });

  it("offers Reintentar after an error", async () => {
    const search = vi
      .fn<SearchFn>()
      .mockRejectedValueOnce(new Error("red"))
      .mockResolvedValueOnce({ results: [], more: false });
    const { user } = setup(search, "cena");
    await user.click(await screen.findByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText(/Prueba con otra palabra/)).toBeVisible();
  });

  it("closes with Escape", async () => {
    history.pushState(null, "", "/dashboard/search");
    const { user } = setup(vi.fn<SearchFn>());
    await user.keyboard("{Escape}");
    expect(router.back).toHaveBeenCalled();
  });
});
