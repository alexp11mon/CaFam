import { describe, expect, it } from "vitest";
import { imageAlt } from "@/lib/images/alt";
import {
  IMAGE_MESSAGES,
  fitNotice,
  getImageErrorMessage,
} from "@/lib/images/error-messages";
import { fitWithin } from "@/lib/images/fit";
import {
  FULL_SIDE,
  MAX_PER_EVENT,
  MAX_PER_USER,
  MAX_SOURCE_BYTES,
  THUMB_SIDE,
  isAcceptedType,
} from "@/lib/images/limits";
import { objectPath } from "@/lib/images/paths";

// Spec 012, T6: pure logic of the images (RF-3, RF-5, RF-14, RF-20 to RF-23).
describe("limits", () => {
  it("match the spec", () => {
    expect(MAX_PER_EVENT).toBe(10);
    expect(MAX_PER_USER).toBe(300);
    expect(MAX_SOURCE_BYTES).toBe(20 * 1024 * 1024);
    expect(FULL_SIDE).toBe(2048);
    expect(THUMB_SIDE).toBe(400);
  });
});

describe("fitWithin (RF-5)", () => {
  it("scales the longer side down to the maximum, keeping the ratio", () => {
    expect(fitWithin(4032, 3024, 2048)).toEqual({ width: 2048, height: 1536 });
    expect(fitWithin(3024, 4032, 2048)).toEqual({ width: 1536, height: 2048 });
    expect(fitWithin(5000, 5000, 400)).toEqual({ width: 400, height: 400 });
    expect(fitWithin(4000, 3, 400)).toEqual({ width: 400, height: 1 });
  });

  it("never scales up a small image", () => {
    expect(fitWithin(800, 600, 2048)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(2048, 100, 2048)).toEqual({ width: 2048, height: 100 });
  });
});

describe("isAcceptedType (RF-3)", () => {
  it("accepts JPEG, PNG, WebP, HEIC and HEIF", () => {
    for (const type of [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/heic",
      "image/heif",
    ]) {
      expect(isAcceptedType(type, "foto")).toBe(true);
    }
  });

  it("rejects other types", () => {
    expect(isAcceptedType("image/gif", "a.gif")).toBe(false);
    expect(isAcceptedType("image/svg+xml", "a.svg")).toBe(false);
    expect(isAcceptedType("application/pdf", "a.pdf")).toBe(false);
  });

  it("falls back to the extension when the browser gives no type", () => {
    expect(isAcceptedType("", "IMG_0001.HEIC")).toBe(true);
    expect(isAcceptedType("", "foto.jpeg")).toBe(true);
    expect(isAcceptedType("", "notas.txt")).toBe(false);
    expect(isAcceptedType("", "")).toBe(false);
  });
});

describe("imageAlt (RF-14)", () => {
  it("names the event and the position", () => {
    expect(imageAlt("Cumpleaños de Ana", 1, 5)).toBe(
      "Cumpleaños de Ana, imagen 2 de 5",
    );
    expect(imageAlt("Viaje", 0, 1)).toBe("Viaje, imagen 1 de 1");
  });
});

describe("objectPath", () => {
  it("puts both variants in the object's folder", () => {
    expect(objectPath("abc", "full")).toBe("abc/full.jpg");
    expect(objectPath("abc", "thumb")).toBe("abc/thumb.jpg");
  });
});

describe("fitNotice (RF-20)", () => {
  it("says how many fit when fewer were reserved", () => {
    expect(fitNotice(5, 5)).toBeUndefined();
    expect(fitNotice(5, 2)).toBe(
      "Solo caben 2 imágenes más en este evento. No se han añadido las demás.",
    );
    expect(fitNotice(3, 1)).toBe(
      "Solo cabe 1 imagen más en este evento. No se han añadido las demás.",
    );
  });
});

describe("getImageErrorMessage", () => {
  it("translates the limits by their message", () => {
    expect(getImageErrorMessage({ code: "CF429", message: "event" })).toBe(
      "Este evento ya tiene 10 imágenes.",
    );
    expect(getImageErrorMessage({ code: "CF429", message: "user" })).toBe(
      "Has llegado al límite de 300 imágenes. Borra alguna para subir más.",
    );
    expect(getImageErrorMessage({ code: "CF429", message: "total" })).toBe(
      "CaFam se ha quedado sin espacio para imágenes. Las que ya hay siguen guardadas.",
    );
  });

  it("translates the other codes and falls back to the connection message", () => {
    expect(getImageErrorMessage({ code: "CF404" })).toBe(
      "Este evento ya no existe o ya no tienes acceso.",
    );
    expect(getImageErrorMessage({ code: "P0002" })).toBe(IMAGE_MESSAGES.upload);
    expect(getImageErrorMessage({ code: "42501" })).toBe(
      "No tienes permiso para hacer esto.",
    );
    expect(getImageErrorMessage({ code: "XX000" })).toBe(
      IMAGE_MESSAGES.connection,
    );
    expect(getImageErrorMessage(new Error("fetch failed"))).toBe(
      IMAGE_MESSAGES.connection,
    );
  });

  it("has every message of the plan in Spanish", () => {
    expect(IMAGE_MESSAGES.type).toBe(
      "Solo se admiten imágenes JPEG, PNG, WebP o HEIC.",
    );
    expect(IMAGE_MESSAGES.tooBig).toBe("La imagen pesa más de 20 MB.");
    expect(IMAGE_MESSAGES.unreadable).toBe(
      "Este navegador no puede leer esta imagen.",
    );
    expect(IMAGE_MESSAGES.upload).toBe("No se ha podido subir la imagen.");
  });
});
