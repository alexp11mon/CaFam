// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TRANSFER_TEXTS } from "@/lib/sharing/transfer-texts";

// Spec 049, T3: the transfer action checks the name and explains each refusal
// of the database (RF-7, RF-9).
const rpc = vi.hoisted(() => vi.fn());
const getCalendar = vi.hoisted(() => vi.fn());

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("@/lib/calendar/queries", () => ({
  requireActionUser: async () => ({ supabase: { rpc }, userId: "me" }),
  getCalendar,
}));

const { transferCalendar } =
  await import("@/app/dashboard/calendars/transfer-actions");

const NEW_OWNER = "6f1c0a5e-8f0e-4c1e-9a43-2b7d7a1f0c11";
function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
}
const run = (fields: Record<string, string>) =>
  transferCalendar("c1", {}, form(fields));

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue({ error: null });
  getCalendar.mockResolvedValue({ name: "Familia", role: "owner" });
});

describe("transferCalendar", () => {
  it("gives it away and goes back to the list", async () => {
    await expect(
      run({ newOwner: NEW_OWNER, confirmName: " Familia " }),
    ).rejects.toThrow("REDIRECT:/dashboard/calendars");
    expect(rpc).toHaveBeenCalledWith("transfer_calendar", {
      p_calendar_id: "c1",
      p_new_owner: NEW_OWNER,
    });
  });

  it("refuses without the right name or a member", async () => {
    expect(await run({ newOwner: NEW_OWNER, confirmName: "Casa" })).toEqual({
      formError: TRANSFER_TEXTS.name,
    });
    expect(await run({ newOwner: "x", confirmName: "Familia" })).toEqual({
      formError: TRANSFER_TEXTS.member,
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("explains a calendar brought from Google or iCloud (RF-9)", async () => {
    rpc.mockResolvedValue({ error: { code: "CF409" } });
    expect(await run({ newOwner: NEW_OWNER, confirmName: "Familia" })).toEqual({
      formError: TRANSFER_TEXTS.synced,
    });
  });
});
