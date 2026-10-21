// @vitest-environment node
import { describe, expect, it } from "vitest";
import { MAX_BYTES } from "@/lib/ics/limits";
import { getFile, readIcsSource } from "@/lib/ics/read-source";

function form(fields: Record<string, string | File>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
}

function file(content: string | Uint8Array, name = "calendario.ics") {
  return new File([content as BlobPart], name, { type: "text/calendar" });
}

describe("getFile", () => {
  it("returns a chosen file", () => {
    expect(getFile(form({ file: file("BEGIN:VCALENDAR") }))).not.toBeNull();
  });

  it("treats an empty file input as no file", () => {
    // Browsers send an empty, unnamed file when nothing was chosen.
    expect(getFile(form({ file: new File([], "") }))).toBeNull();
    expect(getFile(form({}))).toBeNull();
    expect(getFile(form({ file: "texto" }))).toBeNull();
  });
});

describe("readIcsSource (RF-2, RF-26)", () => {
  it("reads the text of a file", async () => {
    const result = await readIcsSource(
      form({ file: file("BEGIN:VCALENDAR\r\nEND:VCALENDAR"), url: "" }),
    );

    expect(result).toEqual({
      ok: true,
      source: { kind: "text", text: "BEGIN:VCALENDAR\r\nEND:VCALENDAR" },
    });
  });

  it("decodes UTF-8", async () => {
    const result = await readIcsSource(
      form({ file: file("SUMMARY:Cumpleaños ñ") }),
    );

    expect(
      result.ok && result.source.kind === "text" && result.source.text,
    ).toBe("SUMMARY:Cumpleaños ñ");
  });

  it("accepts a file of exactly 2 MB", async () => {
    const result = await readIcsSource(
      form({ file: file(new Uint8Array(MAX_BYTES).fill(65)) }),
    );

    expect(result.ok).toBe(true);
  });

  it("rejects a file of 2 MB and one byte without reading it (RF-26)", async () => {
    const result = await readIcsSource(
      form({ file: file(new Uint8Array(MAX_BYTES + 1).fill(65)) }),
    );

    expect(result).toEqual({ ok: false, error: { kind: "too-large" } });
  });

  it("returns the validated link when there is no file (RF-1)", async () => {
    const result = await readIcsSource(
      form({ url: "webcal://calendar.example.com/a.ics" }),
    );

    expect(
      result.ok && result.source.kind === "url" && result.source.url.href,
    ).toBe("https://calendar.example.com/a.ics");
  });

  it("rejects an invalid link (RF-4)", async () => {
    const result = await readIcsSource(
      form({ url: "http://calendar.example.com/a.ics" }),
    );

    expect(result).toEqual({ ok: false, error: { kind: "invalid-url" } });
  });

  it("uses the file when both are given", async () => {
    const result = await readIcsSource(
      form({ file: file("X"), url: "https://calendar.example.com/a.ics" }),
    );

    expect(result.ok && result.source.kind).toBe("text");
  });
});
