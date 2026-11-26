import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  setSpeakAnswers,
  useSpeakAnswers,
} from "@/lib/hooks/use-speak-answers";

// Spec 052 T6: "Leer respuestas en voz alta", off by default and remembered
// on the device (RF-14, plan D5).

function stubSpeech() {
  const speechSynthesis = {
    speak: vi.fn(),
    cancel: vi.fn(),
    getVoices: () => [],
  };
  class Utterance {
    onend: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(public text: string) {}
  }
  vi.stubGlobal("speechSynthesis", speechSynthesis);
  vi.stubGlobal("SpeechSynthesisUtterance", Utterance);
  return speechSynthesis;
}

beforeEach(() => setSpeakAnswers(null));
afterEach(() => vi.unstubAllGlobals());

describe("useSpeakAnswers", () => {
  it("is unsupported and silent without speechSynthesis (RF-15)", () => {
    const { result } = renderHook(() => useSpeakAnswers());
    expect(result.current.supported).toBe(false);
    expect(result.current.on).toBe(false);
  });

  it("is off by default and speaks nothing", () => {
    const speech = stubSpeech();
    const { result } = renderHook(() => useSpeakAnswers());
    expect(result.current.supported).toBe(true);
    expect(result.current.on).toBe(false);
    act(() => result.current.say("Hola"));
    expect(speech.speak).not.toHaveBeenCalled();
  });

  it("remembers it on the device and speaks, then stops", () => {
    const speech = stubSpeech();
    const { result } = renderHook(() => useSpeakAnswers());
    act(() => result.current.setOn(true));
    expect(localStorage.getItem("cafam-speak")).toBe("1");
    expect(result.current.on).toBe(true);
    act(() => result.current.say("Mañana tienes PIAE."));
    expect(speech.speak).toHaveBeenCalledTimes(1);
    expect(result.current.speaking).toBe(true);
    act(() => result.current.stop());
    expect(result.current.speaking).toBe(false);
    act(() => result.current.setOn(false));
    expect(localStorage.getItem("cafam-speak")).toBeNull();
  });
});
