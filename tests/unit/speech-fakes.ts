import { vi } from "vitest";

// Spec 052 T6: shared by the speech tests.

/** A fake SpeechRecognition that the test drives. */
export function fakeRecognition() {
  const made: FakeRecognition[] = [];
  class FakeRecognition {
    lang = "";
    interimResults = false;
    continuous = false;
    onresult: ((event: unknown) => void) | null = null;
    onerror: ((event: { error: string }) => void) | null = null;
    onend: (() => void) | null = null;
    start = vi.fn();
    stop = vi.fn(() => this.onend?.());
    abort = vi.fn();
    constructor() {
      made.push(this);
    }
    hear(...parts: string[]) {
      this.onresult?.({
        resultIndex: 0,
        results: parts.map((transcript) =>
          Object.assign([{ transcript }], { isFinal: false }),
        ),
      });
    }
  }
  return { Ctor: FakeRecognition, made };
}
