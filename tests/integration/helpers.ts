import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// Integration tests run against the Supabase `dev` project (plan D8, D9).
// Values come from `.env.test.local`, loaded by vitest.config.ts.
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}: add it to .env.test.local`);
  }
  return value;
}

const SUPABASE_URL = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
const PUBLISHABLE_KEY = requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
const SECRET_KEY = requireEnv("SUPABASE_SECRET_KEY");

export const TEST_PASSWORD = "test-password-1234";

const clientOptions = {
  auth: { persistSession: false, autoRefreshToken: false },
} as const;

export type TypedClient = SupabaseClient<Database>;

/** Bypasses RLS. Only for fixtures and assertions, never for the case under test. */
export const admin: TypedClient = createClient<Database>(
  SUPABASE_URL,
  SECRET_KEY,
  clientOptions,
);

export function anonClient(): TypedClient {
  return createClient<Database>(SUPABASE_URL, PUBLISHABLE_KEY, clientOptions);
}

export function uniqueEmail(): string {
  return `test-${randomUUID()}@calenderfam.test`;
}

export interface TestUser {
  id: string;
  email: string;
  client: TypedClient;
}

/** Creates a confirmed user with the secret key and signs it in with the publishable key. */
export async function createTestUser(
  metadata: Record<string, unknown> = { display_name: "Test" },
): Promise<TestUser> {
  const email = uniqueEmail();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: metadata,
  });
  if (error) throw error;

  const client = anonClient();
  const { error: signInError } = await client.auth.signInWithPassword({
    email,
    password: TEST_PASSWORD,
  });
  if (signInError) throw signInError;

  return { id: data.user.id, email, client };
}

export async function deleteTestUser(id: string): Promise<void> {
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) throw error;
}

export async function getOwnCalendarId(userId: string): Promise<string> {
  const { data, error } = await admin
    .from("calendars")
    .select("id")
    .eq("owner_id", userId)
    .single();
  if (error) throw error;
  return data.id;
}
