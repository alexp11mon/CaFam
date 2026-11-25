import { afterAll, describe, expect, it } from "vitest";
import { getAuthErrorMessage } from "@/lib/auth/error-messages";
import { signUpSchema } from "@/lib/auth/schemas";
import {
  admin,
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

// Spec 050, T1: an account made with Google takes Google's name (RF-4).
describe("profile name of an account made with Google", () => {
  async function nameOf(
    metadata: Record<string, unknown>,
    email = uniqueEmail(),
  ) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: metadata,
    });
    if (error) throw error;
    createdIds.push(data.user.id);
    const { data: profile } = await admin
      .from("profiles")
      .select("display_name, time_zone")
      .eq("id", data.user.id)
      .single();
    return profile;
  }

  it("uses full_name, cut to 50 characters", async () => {
    expect(await nameOf({ full_name: `  ${"Ana ".repeat(20)}` })).toEqual({
      display_name: "Ana ".repeat(20).trim().slice(0, 50).trim(),
      time_zone: "Europe/Madrid",
    });
  });

  it("uses name, or the address when Google sends none", async () => {
    expect((await nameOf({ name: "Luis Pérez" }))?.display_name).toBe(
      "Luis Pérez",
    );
    const email = uniqueEmail();
    expect((await nameOf({}, email))?.display_name).toBe(email.split("@")[0]);
  });
});
