import { DAILY_QUESTIONS, QUESTION_MAX } from "./limits";

// Texts of the assistant (spec 015). No server-only imports: the chat uses them.

/** RF-28. */
export const UNAVAILABLE_TEXT = "El asistente no está disponible ahora mismo";
/** RF-27. */
export const QUOTA_TEXT = `Has hecho las ${DAILY_QUESTIONS} preguntas de hoy. Podrás seguir mañana.`;
/** Edge case "sin conexión". */
export const NETWORK_TEXT =
  "No hay conexión. Comprueba tu conexión a internet e inténtalo de nuevo.";
export const INVALID_TEXT = "La conversación no es válida. Empieza una nueva.";
export const SESSION_TEXT = "Tu sesión ha caducado. Vuelve a entrar.";

export const QUESTION_MESSAGES = {
  empty: "Escribe una pregunta.",
  tooLong: `La pregunta puede tener como mucho ${QUESTION_MAX} caracteres.`,
} as const;
