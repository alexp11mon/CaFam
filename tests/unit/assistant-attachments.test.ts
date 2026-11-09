import { describe, expect, it } from "vitest";
import {
  ATTACH_MESSAGES,
  MAX_ATTACHMENTS,
  checkAttachments,
} from "@/lib/assistant/attachments";

// Spec 022, T2: what may be attached to a question (RF-4 to RF-8).
function file(name: string, type: string, size = 1000) {
  const f = new File(["x"], name, { type });
  Object.defineProperty(f, "size", { value: size });
  return f;
}

describe("checkAttachments", () => {
  it("accepts JPEG, PNG, WebP and HEIC up to three (RF-4, RF-6)", () => {
    const files = [
      file("a.jpg", "image/jpeg"),
      file("b.png", "image/png"),
      file("c.heic", ""),
    ];
    expect(checkAttachments(0, files)).toEqual({ accepted: files, errors: [] });
    expect(MAX_ATTACHMENTS).toBe(3);
  });

  it("refuses a fourth image (RF-5)", () => {
    const files = [file("a.jpg", "image/jpeg"), file("b.webp", "image/webp")];
    const result = checkAttachments(2, files);
    expect(result.accepted).toEqual([files[0]]);
    expect(result.errors).toEqual([ATTACH_MESSAGES.tooMany]);
    expect(ATTACH_MESSAGES.tooMany).toBe(
      "Puedes adjuntar 3 imágenes como mucho",
    );
  });

  it("names the file of a type that is not accepted (RF-7)", () => {
    const result = checkAttachments(0, [file("horario.gif", "image/gif")]);
    expect(result.accepted).toEqual([]);
    expect(result.errors).toEqual([
      "horario.gif: Solo se admiten imágenes JPEG, PNG, WebP o HEIC.",
    ]);
  });

  it("refuses more than 20 MB with the limit (RF-8)", () => {
    const result = checkAttachments(0, [
      file("grande.jpg", "image/jpeg", 20 * 1024 * 1024 + 1),
    ]);
    expect(result.errors).toEqual(["grande.jpg: La imagen pesa más de 20 MB."]);
  });

  it("does not count refused files against the limit", () => {
    const files = [
      file("a.gif", "image/gif"),
      file("b.jpg", "image/jpeg"),
      file("c.jpg", "image/jpeg"),
    ];
    const result = checkAttachments(1, files);
    expect(result.accepted).toEqual([files[1], files[2]]);
    expect(result.errors).toHaveLength(1);
  });
});
