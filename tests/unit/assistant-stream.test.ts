import { describe, expect, it } from "vitest";
import {
  encodeLine,
  readLines,
  statusFor,
  STATUS,
  type StreamLine,
} from "@/lib/assistant/stream";

// Spec 024, T7 (RF-16).
function bodyOf(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

async function collect(chunks: string[]): Promise<StreamLine[]> {
  const lines: StreamLine[] = [];
  for await (const line of readLines(bodyOf(chunks))) lines.push(line);
  return lines;
}

const done: StreamLine = {
  type: "done",
  answer: "Hoy tienes «Médico».",
  events: [],
  remaining: 29,
};

describe("readLines", () => {
  it("reads back what encodeLine wrote, one object per line", async () => {
    const status: StreamLine = { type: "status", text: STATUS.events };
    expect(await collect([encodeLine(status), encodeLine(done)])).toEqual([
      status,
      done,
    ]);
  });

  it("joins a line split between chunks, also inside a letter", async () => {
    const text = encodeLine({ type: "status", text: "Buscando «niño»…" });
    const bytes = new TextEncoder().encode(text);
    // Cut in the middle of the two bytes of "ñ".
    const cut = bytes.indexOf(0xc3, 20) + 1;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, cut));
        controller.enqueue(bytes.slice(cut));
        controller.close();
      },
    });
    const lines: StreamLine[] = [];
    for await (const line of readLines(body)) lines.push(line);
    expect(lines).toEqual([{ type: "status", text: "Buscando «niño»…" }]);
  });

  it("takes several lines in one chunk and a last one without newline", async () => {
    const a = encodeLine({ type: "status", text: "a" });
    const b = encodeLine({ type: "status", text: "b" });
    expect(await collect([a + b + JSON.stringify(done)])).toEqual([
      { type: "status", text: "a" },
      { type: "status", text: "b" },
      done,
    ]);
  });

  it("skips what is not a known line", async () => {
    expect(
      await collect([
        "\n",
        "not json\n",
        '{"type":"other"}\n',
        encodeLine(done),
      ]),
    ).toEqual([done]);
  });
});

describe("statusFor", () => {
  it("names each tool in the user's words", () => {
    expect(statusFor("list_events", "{}")).toBe("Mirando tu calendario…");
    expect(statusFor("find_free_time", "{}")).toBe("Calculando huecos libres…");
    expect(statusFor("get_comments", "{}")).toBe("Leyendo los comentarios…");
  });

  it("shows what is being searched, shortened", () => {
    expect(statusFor("search_events", '{"query":" dentista "}')).toBe(
      "Buscando «dentista»…",
    );
    expect(
      statusFor("search_events", JSON.stringify({ query: "x".repeat(80) })),
    ).toBe(`Buscando «${"x".repeat(40)}»…`);
  });

  it("stays generic when the call is malformed", () => {
    expect(statusFor("search_events", "{oops")).toBe(
      "Buscando en tus eventos…",
    );
    expect(statusFor("search_events", '{"query":5}')).toBe(
      "Buscando en tus eventos…",
    );
  });
});
