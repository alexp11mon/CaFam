import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FOLDED_KEY,
  FOLDED_MAX,
  isFolded,
  parseFolded,
  withChoice,
} from "@/lib/calendar/folded";
import { resetFolded, setFolded, useFolded } from "@/lib/hooks/use-folded";

describe("folded choices (spec 032 RF-6)", () => {
  it("reads only ids with a boolean and tolerates garbage", () => {
    expect(parseFolded(null)).toEqual({});
    expect(parseFolded("no json")).toEqual({});
    expect(parseFolded("[1,2]")).toEqual({});
    expect(parseFolded('{"group:a":true,"x":"yes","":false}')).toEqual({
      "group:a": true,
    });
  });

  it("takes the default without a choice", () => {
    expect(isFolded({}, "group:a")).toBe(false);
    expect(isFolded({}, "categories:c", true)).toBe(true);
    expect(isFolded({ "categories:c": false }, "categories:c", true)).toBe(
      false,
    );
  });

  it("keeps the newest choices only", () => {
    let choices = {};
    for (let i = 0; i <= FOLDED_MAX; i++)
      choices = withChoice(choices, `g${i}`, true);
    expect(Object.keys(choices)).toHaveLength(FOLDED_MAX);
    expect(choices).not.toHaveProperty("g0");
    choices = withChoice(choices, "g1", false);
    expect(Object.keys(choices).at(-1)).toBe("g1");
  });
});

function Probe({ id, byDefault }: { id: string; byDefault?: boolean }) {
  const [folded] = useFolded(id, byDefault);
  return <p>{folded ? "plegado" : "desplegado"}</p>;
}

describe("useFolded", () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    resetFolded();
  });

  it("remembers a choice on the device and shares it", () => {
    render(
      <>
        <Probe id="group:a" />
        <Probe id="group:a" />
      </>,
    );
    expect(screen.getAllByText("desplegado")).toHaveLength(2);

    act(() => setFolded("group:a", true));

    expect(screen.getAllByText("plegado")).toHaveLength(2);
    expect(JSON.parse(localStorage.getItem(FOLDED_KEY)!)).toEqual({
      "group:a": true,
    });
  });

  it("reads what was saved before", () => {
    localStorage.setItem(FOLDED_KEY, '{"group:a":true}');
    resetFolded();
    render(<Probe id="group:a" />);
    expect(screen.getByText("plegado")).toBeInTheDocument();
  });

  it("works without storage, with the defaults", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    resetFolded();
    render(<Probe id="categories:c" byDefault />);
    expect(screen.getByText("plegado")).toBeInTheDocument();

    act(() => setFolded("categories:c", false));
    expect(screen.getByText("desplegado")).toBeInTheDocument();
  });
});
