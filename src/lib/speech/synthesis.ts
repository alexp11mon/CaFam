// Spec 052 RF-14, RF-15 (plan D4): Venito's answers read aloud with the
// browser's speechSynthesis, in a Spanish voice when there is one.

interface Synth {
  speak(utterance: SpeechSynthesisUtterance): void;
  cancel(): void;
  getVoices(): SpeechSynthesisVoice[];
}

function synth(scope: object = globalThis): Synth | null {
  const holder = scope as {
    speechSynthesis?: Synth;
    SpeechSynthesisUtterance?: unknown;
  };
  return holder.speechSynthesis && holder.SpeechSynthesisUtterance
    ? holder.speechSynthesis
    : null;
}

export const canSpeak = (scope: object = globalThis) => synth(scope) !== null;

/** Spain's Spanish first, then any Spanish; null leaves the default. */
export function spanishVoice(
  voices: readonly Pick<SpeechSynthesisVoice, "lang">[],
): number {
  const lang = (voice: Pick<SpeechSynthesisVoice, "lang">) =>
    voice.lang.toLowerCase().replace("_", "-");
  const spain = voices.findIndex((voice) => lang(voice) === "es-es");
  return spain >= 0
    ? spain
    : voices.findIndex((voice) => lang(voice).startsWith("es"));
}

/** Reads `text`, stopping whatever was being read; `onEnd` once it ends. */
export function speak(
  text: string,
  onEnd: () => void,
  scope: object = globalThis,
): boolean {
  const speech = synth(scope);
  if (!speech || !text.trim()) return false;
  const Utterance = (
    scope as { SpeechSynthesisUtterance: typeof SpeechSynthesisUtterance }
  ).SpeechSynthesisUtterance;
  speech.cancel();
  const utterance = new Utterance(text);
  utterance.lang = "es-ES";
  const voices = speech.getVoices();
  const index = spanishVoice(voices);
  if (index >= 0) utterance.voice = voices[index]!;
  utterance.onend = onEnd;
  utterance.onerror = onEnd;
  speech.speak(utterance);
  return true;
}

export function stopSpeaking(scope: object = globalThis): void {
  synth(scope)?.cancel();
}
