import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin } from "./helpers";

// Spec 006, T8: the scheduled account jobs and the mail queue (plan D3, D4;
// RF-23, RF-26, RF-29). The real send needs the Brevo keys in Vault, which the
// test does not touch; a dry run checks which rows would be sent.
const insertedIds: number[] = [];

beforeAll(async () => {
  const rows: {
    to_email: string;
    subject: string;
    body: string;
    attempts?: number;
    sent_at?: string;
  }[] = [
    { to_email: "pendiente@calenderfam.test", subject: "T8", body: "x" },
    {
      to_email: "agotado@calenderfam.test",
      subject: "T8",
      body: "x",
      attempts: 5,
    },
    {
      to_email: "enviado@calenderfam.test",
      subject: "T8",
      body: "x",
      sent_at: new Date().toISOString(),
    },
  ];
  for (const row of rows) {
    const { data, error } = await admin
      .from("email_outbox")
      .insert(row)
      .select("id")
      .single();
    expect(error).toBeNull();
    insertedIds.push(data!.id);
  }
});

afterAll(async () => {
  await admin.from("email_outbox").delete().in("id", insertedIds);
});

describe("scheduled account jobs (D3)", () => {
  it("the three account jobs are scheduled", async () => {
    const { data, error } = await admin.rpc("account_scheduled_jobs");
    expect(error).toBeNull();
    expect(data).toEqual(
      expect.arrayContaining([
        { jobname: "account-apply-orphans", schedule: "0 3 * * *" },
        { jobname: "account-send-emails", schedule: "*/15 * * * *" },
        { jobname: "account-purge-recovery", schedule: "0 4 * * *" },
      ]),
    );
  });
});

describe("send_pending_emails (D4)", () => {
  it("a dry run lists only pending mail under the attempt limit", async () => {
    const { data, error } = await admin.rpc("send_pending_emails", {
      p_dry_run: true,
      p_limit: 1000,
    });
    expect(error).toBeNull();
    expect(data).toContain(insertedIds[0]);
    expect(data).not.toContain(insertedIds[1]);
    expect(data).not.toContain(insertedIds[2]);
  });

  it("a dry run changes nothing: no attempt is counted and no request is recorded", async () => {
    const { data } = await admin
      .from("email_outbox")
      .select("attempts, request_id, sent_at")
      .eq("id", insertedIds[0]);
    expect(data).toEqual([{ attempts: 0, request_id: null, sent_at: null }]);
  });

  it("the dry run also works with the default batch size", async () => {
    const { error } = await admin.rpc("send_pending_emails", {
      p_dry_run: true,
    });
    expect(error).toBeNull();
  });
});
