import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useStableJson, useStableList } from "@/lib/hooks/use-stable-list";

// Spec 024 (RNF-5): a prefetch must not paint the visible period again.
describe("useStableList", () => {
  const a = { id: "a" };
  const b = { id: "b" };

  it("keeps the first array while the items are the same", () => {
    const first = [a, b];
    const { result, rerender } = renderHook(({ list }) => useStableList(list), {
      initialProps: { list: first },
    });
    rerender({ list: [a, b] });
    expect(result.current).toBe(first);
  });

  it("gives the new array when an item, the order or the length change", () => {
    const { result, rerender } = renderHook(({ list }) => useStableList(list), {
      initialProps: { list: [a, b] },
    });
    for (const next of [[b, a], [a], [a, { id: "b" }]]) {
      rerender({ list: next });
      expect(result.current).toBe(next);
    }
  });
});

describe("useStableJson", () => {
  it("keeps the first object while it says the same", () => {
    const first = { "2026-11-10": ["c1"] };
    const { result, rerender } = renderHook(
      ({ value }) => useStableJson(value),
      {
        initialProps: { value: first },
      },
    );
    rerender({ value: { "2026-11-10": ["c1"] } });
    expect(result.current).toBe(first);
    const changed = { "2026-11-10": ["c1", "c2"] };
    rerender({ value: changed });
    expect(result.current).toBe(changed);
  });
});
