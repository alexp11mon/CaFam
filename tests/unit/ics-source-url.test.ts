import { describe, expect, it } from "vitest";
import {
  FETCH_TIMEOUT_MS,
  HORIZON_MONTHS,
  MAX_BYTES,
  MAX_EVENTS,
  MAX_REDIRECTS,
  COUNT_CAP,
} from "@/lib/ics/limits";
import { parseSourceUrl } from "@/lib/ics/source-url";

describe("limits (RF-5, RF-23, RF-26, RF-27)", () => {
  it("match the approved spec", () => {
    expect(MAX_BYTES).toBe(2 * 1024 * 1024);
    expect(MAX_EVENTS).toBe(2000);
    expect(COUNT_CAP).toBe(20000);
    expect(HORIZON_MONTHS).toBe(12);
    expect(FETCH_TIMEOUT_MS).toBe(15_000);
    expect(MAX_REDIRECTS).toBe(3);
  });
});

describe("parseSourceUrl (RF-3, RF-4)", () => {
  it("accepts https links", () => {
    const result = parseSourceUrl("https://calendar.example.com/a/b.ics?x=1");

    expect(result.ok).toBe(true);
    expect(result.ok && result.url.href).toBe(
      "https://calendar.example.com/a/b.ics?x=1",
    );
  });

  it("treats webcal:// as https:// (RF-3)", () => {
    const result = parseSourceUrl(
      "webcal://p01-caldav.icloud.com/published/2/abc",
    );

    expect(result.ok && result.url.href).toBe(
      "https://p01-caldav.icloud.com/published/2/abc",
    );
  });

  it("is case insensitive on the scheme and trims spaces", () => {
    const result = parseSourceUrl("  WEBCAL://example.com/a.ics \n");

    expect(result.ok && result.url.href).toBe("https://example.com/a.ics");
  });

  it("accepts the default https port written out", () => {
    expect(parseSourceUrl("https://example.com:443/a.ics").ok).toBe(true);
  });

  it.each([
    "http://example.com/a.ics",
    "ftp://example.com/a.ics",
    "file:///etc/passwd",
    "javascript:alert(1)",
    "data:text/calendar,BEGIN:VCALENDAR",
    "https://example.com:8443/a.ics",
    "https://example.com:80/a.ics",
    "https://user:secret@example.com/a.ics",
    "https://user@example.com/a.ics",
    "https://10.0.0.1/a.ics",
    "https://127.0.0.1/a.ics",
    "https://169.254.169.254/latest/meta-data",
    "https://[::1]/a.ics",
    "https://[::ffff:10.0.0.1]/a.ics",
    "",
    "   ",
    "no es una url",
    "https://",
  ])("rejects %j (RF-4)", (raw) => {
    expect(parseSourceUrl(raw).ok).toBe(false);
  });

  it("accepts a public IP written by hand", () => {
    expect(parseSourceUrl("https://8.8.8.8/a.ics").ok).toBe(true);
  });
});
