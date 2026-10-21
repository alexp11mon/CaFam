import { afterAll, describe, expect, it } from "vitest";
import { getAuthErrorMessage } from "@/lib/auth/error-messages";
import { signUpSchema } from "@/lib/auth/schemas";
import {
  anonClient,
  deleteTestUser,
  TEST_PASSWORD,
  uniqueEmail,
} from "./helpers";

const createdIds: string[] = [];

afterAll(async () => {
  await Promise.all(createdIds.map((id) => deleteTestUser(id)));
});

describe("sign-up against Supabase Auth", () => {
  it("rejects a duplicate email, ignoring case and outer spaces (RF-2)", async () => {
    const email = uniqueEmail();
    const first = await anonClient().auth.signUp({
      email,
      password: TEST_PASSWORD,
      options: { data: { display_name: "Primera" } },
    });
    expect(first.error).toBeNull();
    expect(first.data.session).not.toBeNull();
    if (first.data.user) createdIds.push(first.data.user.id);

    // The Server Action normalizes the email with the same schema.
    const { email: normalized } = signUpSchema.parse({
      displayName: "Segunda",
      email: `  ${email.toUpperCase()} `,
      password: TEST_PASSWORD,
    });
    const second = await anonClient().auth.signUp({
      email: normalized,
      password: TEST_PASSWORD,
      options: { data: { display_name: "Segunda" } },
    });

    expect(second.error?.code).toBe("user_already_exists");
    expect(getAuthErrorMessage(second.error)).toBe(
      "Ya existe una cuenta con este email.",
    );
  });
});
