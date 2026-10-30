import { describe, expect, it } from "vitest";
import { getEventImages } from "@/lib/images/queries";

// Spec 012, T8: the images of an event for its detail (RF-9, RF-11, RF-15,
// RF-19).
const ROWS = [
  {
    id: "i1",
    object_id: "o1",
    width: 2048,
    height: 1536,
    created_at: "2026-11-01T10:00:00Z",
    uploaded_by: "ana",
  },
  {
    id: "i2",
    object_id: "o2",
    width: 1536,
    height: 2048,
    created_at: "2026-11-01T11:00:00Z",
    uploaded_by: null,
  },
  {
    id: "i3",
    object_id: "o3",
    width: 100,
    height: 100,
    created_at: "2026-11-01T12:00:00Z",
    uploaded_by: "gone",
  },
];
const MEMBERS = [
  { userId: "ana", name: "Ana" },
  { userId: "me", name: "Yo" },
];

function fakeSupabase(rows: typeof ROWS) {
  const calls: unknown[][] = [];
  const builder = {
    select: (...args: unknown[]) => (calls.push(["select", ...args]), builder),
    eq: (...args: unknown[]) => (calls.push(["eq", ...args]), builder),
    order: (...args: unknown[]) => (calls.push(["order", ...args]), builder),
    then: (resolve: (value: unknown) => void) =>
      resolve({ data: rows, error: null }),
  };
  const supabase = {
    from: (table: string) => (calls.push(["from", table]), builder),
  };
  return { supabase: supabase as never, calls };
}

describe("getEventImages", () => {
  it("lists the ready images in upload order with their author", async () => {
    const { supabase, calls } = fakeSupabase(ROWS);
    const images = await getEventImages(
      supabase,
      "ev",
      "me",
      "viewer",
      MEMBERS,
    );

    expect(calls).toContainEqual(["from", "event_images"]);
    expect(calls).toContainEqual(["eq", "event_id", "ev"]);
    expect(calls).toContainEqual(["eq", "status", "ready"]);
    expect(calls).toContainEqual(["order", "created_at", { ascending: true }]);
    expect(images.map((i) => [i.id, i.author])).toEqual([
      ["i1", "Ana"],
      ["i2", "Cuenta borrada"],
      ["i3", "un antiguo miembro"],
    ]);
    expect(images[0]).toMatchObject({
      objectId: "o1",
      width: 2048,
      height: 1536,
      createdAt: "2026-11-01T10:00:00Z",
    });
  });

  it("lets the uploader, the owner and editors delete", async () => {
    const rows = [{ ...ROWS[0], uploaded_by: "me" }, ROWS[1]];
    const asViewer = await getEventImages(
      fakeSupabase(rows).supabase,
      "ev",
      "me",
      "viewer",
      MEMBERS,
    );
    expect(asViewer.map((i) => i.canDelete)).toEqual([true, false]);
    for (const role of ["owner", "editor"] as const) {
      const images = await getEventImages(
        fakeSupabase(rows).supabase,
        "ev",
        "me",
        role,
        MEMBERS,
      );
      expect(images.every((i) => i.canDelete)).toBe(true);
    }
  });
});
