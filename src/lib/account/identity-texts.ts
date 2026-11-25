// Spec 050, T3: results and texts of "Formas de entrar" (RF-5, RF-6).

export interface IdentityState {
  formError?: string;
  saved?: string;
}

export const IDENTITY_TEXTS = {
  needPassword: "Crea una contraseña antes de desconectar Google.",
  hasPassword: "Tu cuenta ya tiene contraseña: cámbiala en «Contraseña».",
  passwordCreated: "Contraseña creada.",
  unlinked: "Google desconectado.",
} as const;
