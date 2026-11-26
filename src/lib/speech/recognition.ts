// Spec 052 RF-13, RF-15 (plan D4): dictation with the browser's own speech
// recognition. Nothing goes to CaFam's server; some browsers send the audio
// to their maker's service, which the chat says the first time.

/** The part of SpeechRecognition CaFam uses: lib.dom does not type it. */
interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult:
    | ((event: {
        resultIndex: number;
        results: ArrayLike<
          ArrayLike<{ transcript: string }> & { isFinal: boolean }
        >;
      }) => void)
    | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type RecognitionCtor = new () => Recognition;

/** The constructor, prefixed in Chrome and Safari; null without support. */
export function recognitionCtor(
  scope: object = globalThis,
): RecognitionCtor | null {
  const holder = scope as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return holder.SpeechRecognition ?? holder.webkitSpeechRecognition ?? null;
}

export const canDictate = (scope: object = globalThis) =>
  recognitionCtor(scope) !== null;

export type DictationError = "denied" | "failed";

export const DICTATION_ERRORS: Record<DictationError, string> = {
  denied:
    "No hay permiso para usar el micrófono. Puedes darlo en los ajustes del navegador.",
  failed: "No se ha podido escuchar. Inténtalo de nuevo.",
};

export interface Dictation {
  stop(): void;
}

/**
 * Starts listening in Spanish. `onText` gets everything heard so far, while
 * it is said; `onEnd` comes once, after `stop()` or when the browser stops.
 */
export function startDictation(
  handlers: {
    onText: (text: string) => void;
    onError: (error: DictationError) => void;
    onEnd: () => void;
  },
  scope: object = globalThis,
): Dictation | null {
  const Ctor = recognitionCtor(scope);
  if (!Ctor) return null;
  const recognition = new Ctor();
  recognition.lang = "es-ES";
  recognition.interimResults = true;
  recognition.continuous = true;
  recognition.onresult = (event) => {
    let text = "";
    for (let index = 0; index < event.results.length; index++) {
      text += event.results[index]![0]?.transcript ?? "";
    }
    handlers.onText(text.trim());
  };
  recognition.onerror = (event) => {
    // "no-speech" and "aborted" are a silence or a stop, not a failure.
    if (event.error === "no-speech" || event.error === "aborted") return;
    handlers.onError(
      event.error === "not-allowed" || event.error === "service-not-allowed"
        ? "denied"
        : "failed",
    );
  };
  recognition.onend = () => handlers.onEnd();
  try {
    recognition.start();
  } catch {
    handlers.onError("failed");
    return null;
  }
  return { stop: () => recognition.stop() };
}
