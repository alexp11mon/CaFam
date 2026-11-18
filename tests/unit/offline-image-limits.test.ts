import { describe, expect, it } from "vitest";
import { imageRoom, MAX_PENDING_IMAGES } from "@/lib/offline/image-limits";

// Spec 035 T2 (RF-33, RF-34).
describe("imageRoom", () => {
  it("counts saved and pending images of the event up to 10 (RF-33)", () => {
    expect(imageRoom({ saved: 6, pendingHere: 2, pendingAll: 2 })).toEqual({
      room: 2,
      reason: null,
    });
    expect(imageRoom({ saved: 8, pendingHere: 2, pendingAll: 2 })).toEqual({
      room: 0,
      reason: "Este evento ya tiene 10 imágenes.",
    });
  });

  it("allows 20 pending images in all and says so at the limit (RF-34)", () => {
    expect(MAX_PENDING_IMAGES).toBe(20);
    expect(imageRoom({ saved: 0, pendingHere: 0, pendingAll: 17 }).room).toBe(
      3,
    );
    expect(imageRoom({ saved: 0, pendingHere: 0, pendingAll: 20 })).toEqual({
      room: 0,
      reason:
        "Sin conexión puedes dejar como mucho 20 imágenes pendientes de enviar.",
    });
  });
});
