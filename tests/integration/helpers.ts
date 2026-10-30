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
  return `test-${randomUUID()}@cafam.test`;
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

// Deleting users in parallel can deadlock on the cascades (members, preferences):
// Supabase answers "Database error deleting user", so retry a few times.
export async function deleteTestUser(id: string): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (!error) return;
    if (attempt === 4) throw error;
    await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
  }
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

/**
 * Removes the queued mail that deleting test accounts generates for their
 * @cafam.test users (spec 006, T23; spec 010, T4). The sender already skips .test
 * addresses; this keeps the dev queue clean.
 */
export async function deleteTestMail(): Promise<void> {
  const { error } = await admin
    .from("email_outbox")
    .delete()
    .like("to_email", "%@cafam.test");
  if (error) throw error;
}

/**
 * Removes the purge queue rows of a test's image objects (spec 012). Call it
 * after deleting the test users: their cascades queue objects too. In chunks,
 * so the list of ids fits in the request URL.
 */
export async function deleteQueuedImages(objectIds: string[]): Promise<void> {
  for (let i = 0; i < objectIds.length; i += 100) {
    const { error } = await admin
      .from("image_purge_queue")
      .delete()
      .in("object_id", objectIds.slice(i, i + 100));
    if (error) throw error;
  }
}
