import { describe, expect, it } from "vitest";
import {
  deleteAccountSchema,
  changeEmailSchema,
  changePasswordSchema,
  profileSchema,
} from "@/lib/account/schemas";

// Spec 006, T12: the account forms reuse the registration rules (RF-13, RF-15,
// RF-30) and check the address the same way (RF-8).

describe("profileSchema (RF-13, RF-15)", () => {
  it("accepts a name from 1 to 50 characters", () => {
    expect(
      profileSchema.safeParse({ displayName: "Ana", timeZone: "Europe/Madrid" })
        .success,
    ).toBe(true);
    expect(
      profileSchema.safeParse({
        displayName: "a".repeat(50),
        timeZone: "Europe/Madrid",
      }).success,
    ).toBe(true);
  });

  it("rejects an empty name and one of 51 characters (RF-15)", () => {
    expect(
      profileSchema.safeParse({ displayName: "   ", timeZone: "Europe/Madrid" })
        .success,
    ).toBe(false);
    expect(
      profileSchema.safeParse({
        displayName: "a".repeat(51),
        timeZone: "Europe/Madrid",
      }).success,
    ).toBe(false);
  });

  it("rejects a time zone the platform does not know (RF-15)", () => {
    const result = profileSchema.safeParse({
      displayName: "Ana",
      timeZone: "Mars/Olympus",
    });
    expect(result.success).toBe(false);
  });
});

describe("changeEmailSchema (RF-6, RF-8)", () => {
  it("normalizes the new address like the registration does", () => {
    const result = changeEmailSchema.parse({
      newEmail: "  Ana@Example.COM ",
      currentPassword: "clave-actual",
    });
    expect(result.newEmail).toBe("ana@example.com");
  });

  it("rejects an address that is not valid (RF-8)", () => {
    expect(
      changeEmailSchema.safeParse({
        newEmail: "no-es-email",
        currentPassword: "clave-actual",
      }).success,
    ).toBe(false);
  });

  it("requires the current password to be written (RF-6)", () => {
    expect(
      changeEmailSchema.safeParse({
        newEmail: "ana@example.com",
        currentPassword: "",
      }).success,
    ).toBe(false);
  });
});

describe("changePasswordSchema (RF-30)", () => {
  it("accepts a new password of 8 to 72 characters", () => {
    expect(
      changePasswordSchema.safeParse({
        currentPassword: "actual-1234",
        newPassword: "nueva-12345",
      }).success,
    ).toBe(true);
  });

  it("rejects a new password shorter than 8 or longer than 72 characters", () => {
    expect(
      changePasswordSchema.safeParse({
        currentPassword: "actual-1234",
        newPassword: "corta",
      }).success,
    ).toBe(false);
    expect(
      changePasswordSchema.safeParse({
        currentPassword: "actual-1234",
        newPassword: "a".repeat(73),
      }).success,
    ).toBe(false);
  });

  it("requires the current password, leaving the 'same as before' check to the action (RF-32)", () => {
    expect(
      changePasswordSchema.safeParse({
        currentPassword: "",
        newPassword: "nueva-12345",
      }).success,
    ).toBe(false);
  });
});

describe("deleteAccountSchema (RF-16, RF-17)", () => {
  it("needs both the email and the password", () => {
    expect(
      deleteAccountSchema.safeParse({
        email: "ana@example.com",
        password: "clave-actual",
      }).success,
    ).toBe(true);
    expect(
      deleteAccountSchema.safeParse({ email: "", password: "clave-actual" })
        .success,
    ).toBe(false);
    expect(
      deleteAccountSchema.safeParse({ email: "ana@example.com", password: "" })
        .success,
    ).toBe(false);
  });
});
