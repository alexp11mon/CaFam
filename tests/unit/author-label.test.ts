import { describe, expect, it } from "vitest";
import { authorLabel } from "@/lib/account/author-label";

// Spec 006, T25: who created an event, also when the account no longer exists
// (RF-34 to RF-36, RF-20).
const MEMBERS = [
  { userId: "u1", name: "Ana" },
  { userId: "u2", name: "Bea" },
];

describe("authorLabel (RF-34 to RF-36)", () => {
  it("names a member of the calendar (RF-34)", () => {
    expect(authorLabel("u2", MEMBERS)).toBe("Bea");
  });

  it("says Cuenta borrada when the author no longer has an account (RF-35)", () => {
    expect(authorLabel(null, MEMBERS)).toBe("Cuenta borrada");
  });

  it("says un antiguo miembro when the author left the calendar (RF-36)", () => {
    expect(authorLabel("u9", MEMBERS)).toBe("un antiguo miembro");
  });
});
