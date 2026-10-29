import type { FailureKind } from "./providers/google";

// Why a write to Google failed, in Spanish and never with Google's own text
// (RF-22 to RF-26, RF-30).

export type WriteFailure = "transient" | "revoked" | "rejected" | "gone";

export const WRITE_ERRORS: Record<WriteFailure, string> = {
  transient:
    "Google no responde. No se ha guardado el cambio; vuelve a intentarlo dentro de un momento.",
  revoked:
    "Google ya no deja a CaFam usar esta cuenta. Vuelve a conectarla para guardar cambios.",
  rejected: "Google no ha permitido el cambio, así que no se ha guardado.",
  gone: "Este evento se había borrado en Google y se ha quitado de CaFam.",
};

/** Anything unexpected counts as Google not answering: the user can retry. */
// By name, not instanceof, so client screens can import the texts without the
// Google client.
export function writeFailureOf(error: unknown): WriteFailure {
  if (!(error instanceof Error) || error.name !== "ProviderError") {
    return "transient";
  }
  const kind = (error as Error & { kind: FailureKind }).kind;
  return kind === "missing" ? "gone" : kind;
}
