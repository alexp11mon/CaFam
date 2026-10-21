import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getAuthErrorMessage } from "@/lib/auth/error-messages";
import {
  anonClient,
  createTestUser,
  deleteTestUser,
  TEST_PASSWORD,
  type TestUser,
} from "./helpers";

let user: TestUser;

beforeAll(async () => {
  user = await createTestUser({ display_name: "Login" });
});

afterAll(async () => {
  if (user) await deleteTestUser(user.id);
});

describe("login against Supabase Auth", () => {
  it("returns a session with the right credentials (RF-5)", async () => {
    const { data, error } = await anonClient().auth.signInWithPassword({
      email: user.email,
      password: TEST_PASSWORD,
    });

    expect(error).toBeNull();
    expect(data.session?.user.id).toBe(user.id);
  });

  it.each([
    [
      "a wrong password",
      () => ({ email: user.email, password: "otra-cosa-123" }),
    ],
    [
      "an unknown email",
      () => ({ email: `nadie-${user.email}`, password: TEST_PASSWORD }),
    ],
  ])(
    "returns invalid_credentials for %s without telling which (RF-6)",
    async (_label, credentials) => {
      const { data, error } =
        await anonClient().auth.signInWithPassword(credentials());

      expect(data.session).toBeNull();
      expect(error?.code).toBe("invalid_credentials");
      expect(getAuthErrorMessage(error)).toBe(
        "Email o contraseña incorrectos.",
      );
    },
  );
});
