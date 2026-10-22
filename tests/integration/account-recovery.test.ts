import { createHash } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { admin, anonClient, uniqueEmail } from "./helpers";

// Spec 006, T3: at most 3 recovery links per account every 15 minutes, counted
// on a SHA-256 of the normalized address (plan D6; RF-5, RF-1).
function hashOf(email: string): string {
  const digest = createHash("sha256")
    .update(email.trim().toLowerCase(), "utf8")
    .digest("hex");
  return `\\x${digest}`;
}

const usedEmails: string[] = [];

afterAll(async () => {
  for (const email of usedEmails) {
    await admin
      .from("auth_email_requests")
      .delete()
      .eq("email_hash", hashOf(email));
  }
});

function request(email: string) {
  return anonClient().rpc("request_recovery", { p_email: email });
}

describe("request_recovery (RF-5, D6)", () => {
  it("accepts the first three requests in 15 minutes for one account", async () => {
    const email = uniqueEmail();
    usedEmails.push(email);

    for (let i = 0; i < 3; i++) {
      const { data, error } = await request(email);
      expect(error).toBeNull();
      expect(data).toBe(true);
    }
  });

  it("refuses the fourth request in the same window", async () => {
    const email = uniqueEmail();
    usedEmails.push(email);
    for (let i = 0; i < 3; i++) await request(email);

    const { data, error } = await request(email);
    expect(error).toBeNull();
    expect(data).toBe(false);
  });

  it("counts case and surrounding spaces as the same account", async () => {
    const email = uniqueEmail();
    usedEmails.push(email);
    await request(email);
    await request(email.toUpperCase());
    await request(`  ${email}  `);

    const { data } = await request(email);
    expect(data).toBe(false);
  });

  it("accepts again once the 15-minute window has passed", async () => {
    const email = uniqueEmail();
    usedEmails.push(email);
    const old = new Date(Date.now() - 16 * 60_000).toISOString();
    const { error: seedError } = await admin.from("auth_email_requests").insert(
      [0, 1, 2].map(() => ({
        email_hash: hashOf(email),
        created_at: old,
      })),
    );
    expect(seedError).toBeNull();

    const { data } = await request(email);
    expect(data).toBe(true);
  });

  it("stores only the hash, never the address", async () => {
    const email = uniqueEmail();
    usedEmails.push(email);
    await request(email);

    const { data, error } = await admin
      .from("auth_email_requests")
      .select("*")
      .eq("email_hash", hashOf(email));
    expect(error).toBeNull();
    expect(data?.length).toBeGreaterThan(0);
    expect(Object.keys(data![0]).sort()).toEqual(["created_at", "email_hash"]);
    expect(JSON.stringify(data)).not.toContain(email);
  });

  it("rejects an empty address (22023)", async () => {
    const { error } = await request("   ");
    expect(error?.code).toBe("22023");
  });
});
