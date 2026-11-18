// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createRefs } from "@/lib/assistant/citations";
import {
  runTool,
  type CitedEvent,
  type ToolContext,
} from "@/lib/assistant/tools";

// Spec 036, T6: the write tools only exist when the route binds them to the
// session (plan D2, RF-39, RF-40).
const ctx = (writes?: ToolContext["writes"]): ToolContext => ({
  supabase: {} as never,
  userId: "u1",
  timeZone: "Europe/Madrid",
  now: new Date("2026-11-18T09:00:00Z"),
  refs: createRefs<CitedEvent>(),
  excludeSynced: false,
  writes,
});

describe("runTool and the write tools", () => {
  it("does not know them without writes", async () => {
    expect(await runTool("create_events", "{}", ctx())).toEqual({
      status: "unknown_tool",
    });
  });

  it("hands them the parsed arguments", async () => {
    const create = vi.fn(async () => ({ status: "created" }));
    const propose = vi.fn(async () => ({ status: "proposed" }));
    const context = ctx({ create_events: create, propose_changes: propose });
    expect(
      await runTool("create_events", '{"events":[{"title":"A"}]}', context),
    ).toEqual({ status: "created" });
    expect(create).toHaveBeenCalledWith({ events: [{ title: "A" }] });
    expect(await runTool("propose_changes", "{}", context)).toEqual({
      status: "proposed",
    });
    expect(await runTool("create_events", "{oops", context)).toEqual({
      status: "invalid_arguments",
    });
  });

  it("still refuses names it does not know", async () => {
    expect(await runTool("delete_event", "{}", ctx({}))).toEqual({
      status: "unknown_tool",
    });
  });
});
