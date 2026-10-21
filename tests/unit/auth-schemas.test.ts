import { describe, expect, it } from "vitest";
import { signInSchema, signUpSchema } from "@/lib/auth/schemas";

const VALID = {
  displayName: "Ana",
  email: "ana@example.com",
  password: "12345678",
};

function fieldError(input: Record<string, unknown>, field: string) {
  const result = signUpSchema.safeParse(input);
  if (result.success) return undefined;
  return result.error.issues.find((issue) => issue.path[0] === field)?.message;
}

describe("signUpSchema", () => {
  it("normalizes the email to lowercase without outer spaces", () => {
    const result = signUpSchema.parse({
      ...VALID,
      email: "  Ana.Garcia@Example.COM ",
    });

    expect(result.email).toBe("ana.garcia@example.com");
  });

  it.each(["ana@", ""])("rejects the invalid email %j", (email) => {
    expect(fieldError({ ...VALID, email }, "email")).toBe(
      "Introduce un email válido.",
    );
  });

  it.each([
    [7, "La contraseña debe tener al menos 8 caracteres."],
    [8, undefined],
    [72, undefined],
    [73, "La contraseña no puede superar los 72 caracteres."],
  ])("password of %i characters → %s", (length, message) => {
    expect(
      fieldError({ ...VALID, password: "a".repeat(length) }, "password"),
    ).toBe(message);
  });

  it.each(["", "   "])("rejects the empty display name %j", (displayName) => {
    expect(fieldError({ ...VALID, displayName }, "displayName")).toBe(
      "Introduce tu nombre.",
    );
  });

  it("accepts a 50-character name and rejects one of 51", () => {
    expect(
      fieldError({ ...VALID, displayName: "a".repeat(50) }, "displayName"),
    ).toBeUndefined();
    expect(
      fieldError({ ...VALID, displayName: "a".repeat(51) }, "displayName"),
    ).toBe("El nombre no puede superar los 50 caracteres.");
  });

  it("trims the display name", () => {
    const result = signUpSchema.parse({ ...VALID, displayName: "  Ana  " });

    expect(result.displayName).toBe("Ana");
  });

  it("keeps a valid time zone (RF-26)", () => {
    const result = signUpSchema.parse({ ...VALID, timeZone: "America/Bogota" });

    expect(result.timeZone).toBe("America/Bogota");
  });

  it.each([
    ["missing", undefined],
    ["empty", ""],
    ["invalid", "Marte/Olympus"],
    ["too long", `Europe/${"a".repeat(64)}`],
    ["not a string", 42],
  ])("discards a %s time zone without error (RF-26)", (_label, timeZone) => {
    const result = signUpSchema.safeParse({ ...VALID, timeZone });

    expect(result.success).toBe(true);
    expect(result.data?.timeZone).toBeUndefined();
  });
});

describe("signInSchema", () => {
  it("normalizes the email", () => {
    const result = signInSchema.parse({
      email: " ANA@example.com",
      password: "x",
    });

    expect(result.email).toBe("ana@example.com");
  });

  it("requires a password", () => {
    const result = signInSchema.safeParse({
      email: "ana@example.com",
      password: "",
    });

    expect(result.success).toBe(false);
  });
});
