// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IMAGE_MESSAGES } from "@/lib/images/error-messages";

// Spec 012, T8: Server Actions of the event images (plan "Server Actions";
// RF-2, RF-15, RF-20, RF-22, RF-23).
const EVENT = "5b8f6c2e-3f0a-4d8e-9a51-2a8f1d7c9e10";
const IMAGE = "0d7e1c6a-8b2f-4c3d-9e4f-5a6b7c8d9e0f";
const OBJECT = "11111111-1111-4111-8111-111111111111";
const SPEC = { bytes: 300_000, width: 2048, height: 1536 };

const h = vi.hoisted(() => ({
  rpc: vi.fn(),
  deleted: [] as { object_id: string }[] | null,
  visible: false,
  deleteFilters: [] as [string, unknown][],
  purgeObjects: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: h.revalidatePath }));
vi.mock("@/lib/images/purge", () => ({
  purgeObjects: h.purgeObjects,
  purgeDeps: () => ({ supabase: "anon", secret: "s" }),
}));
vi.mock("@/lib/calendar/queries", () => ({
  requireActionUser: async () => ({
    userId: "me",
    supabase: {
      rpc: h.rpc,
      from: () => ({
        delete: () => ({
          eq: (column: string, value: unknown) => {
            h.deleteFilters.push([column, value]);
            return {
              select: async () => ({ data: h.deleted, error: null }),
            };
          },
        }),
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: h.visible ? { id: IMAGE } : null,
              error: null,
            }),
          }),
        }),
      }),
    },
  }),
}));

const { cancelImage, confirmImage, deleteImage, reserveImages } =
  await import("@/app/dashboard/events/image-actions");

beforeEach(() => {
  h.rpc.mockReset();
  h.purgeObjects.mockReset();
  h.purgeObjects.mockResolvedValue(1);
  h.revalidatePath.mockClear();
  h.deleted = [{ object_id: OBJECT }];
  h.visible = false;
  h.deleteFilters = [];
});

describe("reserveImages (RF-2, RF-20, RF-22, RF-23)", () => {
  it("reserves and returns the ids", async () => {
    h.rpc.mockResolvedValue({ data: ["a", "b"], error: null });
    expect(await reserveImages(EVENT, [SPEC, SPEC])).toEqual({
      ids: ["a", "b"],
    });
    expect(h.rpc).toHaveBeenCalledWith("reserve_event_images", {
      p_event_id: EVENT,
      p_images: [SPEC, SPEC],
    });
  });

  it("says how many fit when fewer were reserved", async () => {
    h.rpc.mockResolvedValue({ data: ["a"], error: null });
    expect(await reserveImages(EVENT, [SPEC, SPEC, SPEC])).toEqual({
      ids: ["a"],
      notice:
        "Solo cabe 1 imagen más en este evento. No se han añadido las demás.",
    });
  });

  it("translates the limits and a gone event", async () => {
    h.rpc.mockResolvedValue({
      data: null,
      error: { code: "CF429", message: "user" },
    });
    expect(await reserveImages(EVENT, [SPEC])).toEqual({
      error: IMAGE_MESSAGES.userFull,
    });
    h.rpc.mockResolvedValue({ data: null, error: { code: "CF404" } });
    expect(await reserveImages(EVENT, [SPEC])).toEqual({
      error: IMAGE_MESSAGES.gone,
    });
  });

  it("validates its input before calling the database", async () => {
    expect(await reserveImages("x", [SPEC])).toHaveProperty("error");
    expect(await reserveImages(EVENT, [])).toHaveProperty("error");
    expect(
      await reserveImages(EVENT, [{ bytes: 1, width: 0, height: 1 }]),
    ).toHaveProperty("error");
    expect(h.rpc).not.toHaveBeenCalled();
  });
});

describe("confirmImage", () => {
  it("confirms and refreshes the views", async () => {
    h.rpc.mockResolvedValue({ data: null, error: null });
    expect(await confirmImage(IMAGE)).toEqual({});
    expect(h.rpc).toHaveBeenCalledWith("confirm_event_image", { p_id: IMAGE });
    expect(h.revalidatePath).toHaveBeenCalledWith("/dashboard", "layout");
  });

  it("explains an unfinished upload", async () => {
    h.rpc.mockResolvedValue({ data: null, error: { code: "P0002" } });
    expect(await confirmImage(IMAGE)).toEqual({ error: IMAGE_MESSAGES.upload });
  });
});

describe("deleteImage and cancelImage (RF-15, RF-6)", () => {
  it("deletes the row and then its objects", async () => {
    expect(await deleteImage(IMAGE)).toEqual({});
    expect(h.deleteFilters).toEqual([["id", IMAGE]]);
    expect(h.purgeObjects).toHaveBeenCalledWith("anon", "s", [OBJECT]);
    expect(h.revalidatePath).toHaveBeenCalledWith("/dashboard", "layout");
  });

  it("a failed purge is left to the hourly job", async () => {
    h.purgeObjects.mockRejectedValue(new Error("down"));
    expect(await deleteImage(IMAGE)).toEqual({});
  });

  it("tells a gone image from a forbidden one", async () => {
    h.deleted = [];
    expect(await deleteImage(IMAGE)).toEqual({
      error: "Esta imagen ya no existe.",
    });
    h.visible = true;
    expect(await deleteImage(IMAGE)).toEqual({
      error: IMAGE_MESSAGES.forbidden,
    });
    expect(h.purgeObjects).not.toHaveBeenCalled();
  });

  it("cancel deletes the reservation without refreshing the views", async () => {
    expect(await cancelImage(IMAGE)).toEqual({});
    expect(h.purgeObjects).toHaveBeenCalledWith("anon", "s", [OBJECT]);
    expect(h.revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects an invalid id", async () => {
    expect(await deleteImage("x")).toHaveProperty("error");
    expect(h.deleteFilters).toEqual([]);
  });
});
