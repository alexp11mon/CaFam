import { describe, expect, it } from "vitest";
import {
  accessCodeSchema,
  inviteSchema,
  joinCodeSchema,
  memberRoleSchema,
} from "@/lib/sharing/schemas";
import { fieldErrorsFromZod } from "@/lib/forms/form-state";

const UUID = "11111111-1111-4111-8111-111111111111";

describe("inviteSchema (RF-1, RF-3)", () => {
  it("accepts viewer or editor with 1 to 20 uses", () => {
    for (const role of ["viewer", "editor"]) {
      for (const maxUses of ["1", "5", "20"]) {
        const result = inviteSchema.safeParse({ role, maxUses });
        expect(result.success).toBe(true);
        expect(result.data).toEqual({ role, maxUses: Number(maxUses) });
      }
    }
  });

  it("rejects the owner role and unknown roles (RF-1)", () => {
    for (const role of ["owner", "admin", ""]) {
      const result = inviteSchema.safeParse({ role, maxUses: "1" });
      expect(result.success).toBe(false);
      expect(fieldErrorsFromZod(result.error!).role).toBe("Elige un rol.");
    }
  });

  it("rejects uses outside 1 to 20 or not whole numbers (RF-3)", () => {
    for (const maxUses of ["0", "21", "-1", "1.5", "abc", ""]) {
      const result = inviteSchema.safeParse({ role: "viewer", maxUses });
      expect(result.success).toBe(false);
      expect(fieldErrorsFromZod(result.error!).maxUses).toBe(
        "Elige entre 1 y 20 usos.",
      );
    }
  });
});

describe("accessCodeSchema (RF-14, RF-15)", () => {
  it("accepts PINs of 6 to 10 digits", () => {
    for (const pin of ["123456", "1234567", "1234567890"]) {
      const result = accessCodeSchema.safeParse({ role: "viewer", pin });
      expect(result.success).toBe(true);
      expect(result.data?.pin).toBe(pin);
    }
  });

  it("rejects PINs of 5 or 11 digits and PINs with letters", () => {
    for (const pin of ["12345", "12345678901", "12345a", "12 3456", ""]) {
      const result = accessCodeSchema.safeParse({ role: "viewer", pin });
      expect(result.success).toBe(false);
      expect(fieldErrorsFromZod(result.error!).pin).toBe(
        "El PIN debe tener entre 6 y 10 dígitos.",
      );
    }
  });

  it("rejects the owner role", () => {
    const result = accessCodeSchema.safeParse({ role: "owner", pin: "123456" });
    expect(result.success).toBe(false);
    expect(fieldErrorsFromZod(result.error!).role).toBe("Elige un rol.");
  });
});

describe("joinCodeSchema (RF-19, RF-20)", () => {
  it("normalizes the ID to uppercase without outer spaces", () => {
    const result = joinCodeSchema.safeParse({
      code: "  abcd2345 ",
      pin: " 123456 ",
    });
    expect(result.data).toEqual({ code: "ABCD2345", pin: "123456" });
  });

  it("does not judge the PIN format: the server answers incorrect", () => {
    const result = joinCodeSchema.safeParse({ code: "ABCD2345", pin: "abc" });
    expect(result.success).toBe(true);
  });

  it("asks for both fields", () => {
    const result = joinCodeSchema.safeParse({ code: "  ", pin: "" });
    expect(fieldErrorsFromZod(result.error!)).toEqual({
      code: "Escribe el ID del calendario.",
      pin: "Escribe el PIN.",
    });
  });
});

describe("memberRoleSchema (RF-25)", () => {
  it("accepts a user id with viewer or editor", () => {
    expect(
      memberRoleSchema.safeParse({ userId: UUID, role: "editor" }).success,
    ).toBe(true);
  });

  it("rejects owner and invalid ids", () => {
    expect(
      memberRoleSchema.safeParse({ userId: UUID, role: "owner" }).success,
    ).toBe(false);
    expect(
      memberRoleSchema.safeParse({ userId: "nope", role: "viewer" }).success,
    ).toBe(false);
  });
});
