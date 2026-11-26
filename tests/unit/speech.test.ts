import { describe, expect, it, vi } from "vitest";
import { fakeRecognition } from "./speech-fakes";
import {
  canDictate,
  recognitionCtor,
  startDictation,
} from "@/lib/speech/recognition";
import {
  canSpeak,
  spanishVoice,
  speak,
  stopSpeaking,
} from "@/lib/speech/synthesis";

// Spec 052 T6: the browser's Web Speech API, simulated (RF-13 to RF-15).

describe("recognition", () => {
  it("finds the prefixed constructor, or none (RF-15)", () => {
    const { Ctor } = fakeRecognition();
    expect(recognitionCtor({ webkitSpeechRecognition: Ctor })).toBe(Ctor);
    expect(canDictate({ SpeechRecognition: Ctor })).toBe(true);
    expect(canDictate({})).toBe(false);
    expect(startDictation({ onText() {}, onError() {}, onEnd() {} }, {})).toBe(
      null,
    );
  });

  it("listens in Spanish and gives everything heard so far (RF-13)", () => {
    const { Ctor, made } = fakeRecognition();
    const onText = vi.fn();
    const onEnd = vi.fn();
    const dictation = startDictation(
      { onText, onError: vi.fn(), onEnd },
      { SpeechRecognition: Ctor },
    );
    const recognition = made[0]!;
    expect(recognition.lang).toBe("es-ES");
    expect(recognition.interimResults).toBe(true);
    expect(recognition.start).toHaveBeenCalled();
    recognition.hear("crea cena ", "el viernes");
    expect(onText).toHaveBeenLastCalledWith("crea cena el viernes");
    dictation!.stop();
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it("tells a denied microphone from other failures, and ignores silence", () => {
    const { Ctor, made } = fakeRecognition();
    const onError = vi.fn();
    startDictation(
      { onText: vi.fn(), onError, onEnd: vi.fn() },
      { SpeechRecognition: Ctor },
    );
    made[0]!.onerror!({ error: "no-speech" });
    made[0]!.onerror!({ error: "not-allowed" });
    made[0]!.onerror!({ error: "network" });
    expect(onError.mock.calls).toEqual([["denied"], ["failed"]]);
  });
});

describe("synthesis", () => {
  function fakeSynth(voices: { lang: string }[]) {
    const spoken: { text: string; voice: unknown; lang: string }[] = [];
    class Utterance {
      lang = "";
      voice: unknown = null;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(public text: string) {}
    }
    const speechSynthesis = {
      speak: vi.fn((utterance: Utterance) => spoken.push(utterance)),
      cancel: vi.fn(),
      getVoices: () => voices,
    };
    return {
      scope: { speechSynthesis, SpeechSynthesisUtterance: Utterance },
      spoken,
      speechSynthesis,
    };
  }

  it("prefers a voice of Spain, then any Spanish (RF-14)", () => {
    expect(
      spanishVoice([{ lang: "en-GB" }, { lang: "es-MX" }, { lang: "es_ES" }]),
    ).toBe(2);
    expect(spanishVoice([{ lang: "en-GB" }, { lang: "es-MX" }])).toBe(1);
    expect(spanishVoice([{ lang: "en-GB" }])).toBe(-1);
  });

  it("reads in Spanish, stopping what was being read, and stops", () => {
    const voices = [{ lang: "en-US" }, { lang: "es-ES" }];
    const { scope, spoken, speechSynthesis } = fakeSynth(voices);
    expect(canSpeak(scope)).toBe(true);
    expect(speak("Mañana tienes PIAE.", vi.fn(), scope)).toBe(true);
    expect(speechSynthesis.cancel).toHaveBeenCalledTimes(1);
    expect(spoken[0]).toMatchObject({
      text: "Mañana tienes PIAE.",
      lang: "es-ES",
      voice: voices[1],
    });
    stopSpeaking(scope);
    expect(speechSynthesis.cancel).toHaveBeenCalledTimes(2);
  });

  it("does nothing without support or without text (RF-15)", () => {
    expect(canSpeak({})).toBe(false);
    expect(speak("Hola", vi.fn(), {})).toBe(false);
    const { scope } = fakeSynth([]);
    expect(speak("   ", vi.fn(), scope)).toBe(false);
  });
});
