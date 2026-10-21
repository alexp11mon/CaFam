import { z } from "zod";

const ROLE_MESSAGE = "Elige un rol.";
const USES_MESSAGE = "Elige entre 1 y 20 usos.";

// Only these two roles can be granted: the owner role is never given away (RF-1).
const grantableRole = z.enum(["viewer", "editor"], { error: ROLE_MESSAGE });

export type GrantableRole = z.infer<typeof grantableRole>;

// Invite link (RF-1, RF-3) -------------------------------------------------------

export type InviteField = "role" | "maxUses";

export const inviteSchema = z.object({
  role: grantableRole,
  maxUses: z
    .string()
    .trim()
    .regex(/^\d+$/, USES_MESSAGE)
    .transform(Number)
    .pipe(z.number().min(1, USES_MESSAGE).max(20, USES_MESSAGE)),
});

// ID and PIN chosen by the owner (RF-14, RF-15) ------------------------------------

export type AccessCodeField = "role" | "pin";

export const accessCodeSchema = z.object({
  role: grantableRole,
  pin: z
    .string()
    .trim()
    .regex(/^\d{6,10}$/, "El PIN debe tener entre 6 y 10 dígitos."),
});

// Joining with an ID and PIN (RF-19, RF-20) -----------------------------------------
// The PIN format is not checked here: a malformed PIN is just an incorrect one,
// and the server answers the same way for every failure.

export type JoinCodeField = "code" | "pin";

export const joinCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Escribe el ID del calendario.")
    .transform((value) => value.toUpperCase()),
  pin: z.string().trim().min(1, "Escribe el PIN."),
});

// Role change by the owner (RF-25) ---------------------------------------------------

export const memberRoleSchema = z.object({
  userId: z.uuid(),
  role: grantableRole,
});
