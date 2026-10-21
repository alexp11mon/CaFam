import { z } from "zod";

const MAX_TIME_ZONE_LENGTH = 64;

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Introduce un email válido." }));

function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

// Never produces a visible error: an unusable value is dropped and the
// database falls back to Europe/Madrid (RF-26, plan D13).
const timeZone = z
  .unknown()
  .transform((value) =>
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_TIME_ZONE_LENGTH &&
    isValidTimeZone(value)
      ? value
      : undefined,
  )
  .optional();

export const signUpSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "Introduce tu nombre.")
    .max(50, "El nombre no puede superar los 50 caracteres."),
  email,
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres.")
    .max(72, "La contraseña no puede superar los 72 caracteres."),
  timeZone,
});

export const signInSchema = z.object({
  email,
  password: z.string().min(1),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
