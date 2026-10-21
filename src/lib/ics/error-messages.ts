import { COUNT_CAP, MAX_BYTES, MAX_EVENTS } from "./limits";

/** Everything that can stop an import, without any detail about the source (RF-6). */
export type ImportError =
  | { kind: "invalid-url" }
  | { kind: "unreachable" }
  | { kind: "too-large" }
  | { kind: "too-many"; count: number; capped: boolean }
  | { kind: "not-ics" }
  | { kind: "no-events" }
  | { kind: "create-failed" };

const thousands = (n: number) =>
  String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

/** Spanish message of an import failure (RF-4, RF-5, RF-26..RF-28, RF-30). */
export function getImportErrorMessage(error: ImportError): string {
  switch (error.kind) {
    case "invalid-url":
      return "El enlace no es válido. Debe empezar por https:// o webcal://.";
    case "unreachable":
      return "No se ha podido leer el enlace. Comprueba que es público y vuelve a intentarlo.";
    case "too-large":
      return `El archivo supera el límite de ${MAX_BYTES / (1024 * 1024)} MB.`;
    case "too-many":
      return `El calendario tendría ${
        error.capped ? `más de ${thousands(COUNT_CAP)}` : thousands(error.count)
      } eventos y el límite es de ${thousands(MAX_EVENTS)}.`;
    case "not-ics":
      return "El contenido no es un calendario .ics válido.";
    case "no-events":
      return "El calendario no tiene eventos que se puedan importar.";
    case "create-failed":
      return "No se ha podido crear el calendario. No se ha guardado nada.";
  }
}
