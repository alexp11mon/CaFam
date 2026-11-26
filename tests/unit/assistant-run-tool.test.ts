// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createRefs } from "@/lib/assistant/citations";
import { WRITE_TOOL_DEFINITIONS } from "@/lib/assistant/tool-definitions";
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

  // Spec 052: every write tool offered to the model can also be run.
  it("runs every write tool the model is offered", async () => {
    const names = WRITE_TOOL_DEFINITIONS.map((tool) => tool.function.name);
    expect(names).toEqual(
      expect.arrayContaining(["propose_deletes", "propose_series"]),
    );
    const writes = Object.fromEntries(
      names.map((name) => [name, async () => ({ status: name })]),
    );
    for (const name of names) {
      expect(await runTool(name, "{}", ctx(writes))).toEqual({ status: name });
    }
  });

  it("still refuses names it does not know", async () => {
    expect(await runTool("delete_event", "{}", ctx({}))).toEqual({
      status: "unknown_tool",
    });
  });
});
