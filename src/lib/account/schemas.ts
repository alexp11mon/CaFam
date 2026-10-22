import { z } from "zod";
import { isValidTimeZone, signUpSchema } from "@/lib/auth/schemas";

// Spec 006, T12: the account forms reuse the registration rules (plan
// "Módulos"). Unlike registration, the profile form rejects a bad time zone
// instead of dropping it (RF-15).

const { displayName, email, password } = signUpSchema.shape;

export const profileSchema = z.object({
  displayName,
  timeZone: z
    .string()
    .refine(isValidTimeZone, "Elige una zona horaria válida."),
});

export const changeEmailSchema = z.object({
  newEmail: email,
  currentPassword: z.string().min(1, "Escribe tu contraseña actual."),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Escribe tu contraseña actual."),
  newPassword: password,
});

export const deleteAccountSchema = z.object({
  email,
  password: z.string().min(1, "Escribe tu contraseña."),
});

export type ProfileInput = z.infer<typeof profileSchema>;
export type ChangeEmailInput = z.infer<typeof changeEmailSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
