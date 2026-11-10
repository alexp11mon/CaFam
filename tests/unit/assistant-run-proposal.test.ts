// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { proposalPrompt } from "@/lib/assistant/prompt";
import { dateContext } from "@/lib/assistant/dates";
import type { ProviderMessage } from "@/lib/assistant/provider";
import { runProposal, type ProposalRunDeps } from "@/lib/assistant/run";
import type { ChatMessage, ProposalRow } from "@/lib/assistant/schemas";

// Spec 022, T6: proposals from images and corrections by chat (RF-14,
// RF-17, RF-18, RF-20, RF-20a to RF-20c, RF-23 to RF-25, RF-33, RF-50 to
// RF-52; plan D1b, D2, D3).
const NOW = new Date("2026-11-09T09:00:00Z");
const TZ = "Europe/Madrid";
const WORK = "6f1c0a5e-8f0e-4c1e-9a43-2b7d7a1f0c11";
const IMG = "data:image/jpeg;base64,/9j/4AAQ";

const answer = JSON.stringify({
  question: null,
  calendar: "Trabajo",
  person: "Ana",
  unreadable: null,
  events: [
    {
      title: "Turno",
      date: "2026-11-16",
      start: "08:00",
      end: "15:00",
      endDate: null,
      allDay: false,
    },
  ],
});

function deps(reply = answer) {
  const json = vi.fn<ProposalRunDeps["json"]>(async () => reply);
  const d: ProposalRunDeps = {
    json,
    now: NOW,
    timeZone: TZ,
    proposal: {
      calendars: [{ id: WORK, name: "Trabajo", canWrite: true }],
      timeZone: TZ,
      loadEvents: async () => [],
    },
  };
  return { d, json };
}

const sent = (json: ReturnType<typeof deps>["json"]) =>
  json.mock.calls[0]![0] as ProviderMessage[];

describe("runProposal", () => {
  it("sends the short prompt, the thread as text and the images last (D1b, D2)", async () => {
    const { d, json } = deps();
    const thread: ChatMessage[] = [
      { role: "user", content: "¿Qué tengo hoy?" },
      { role: "assistant", content: "Nada." },
      { role: "user", content: "Soy Ana, en Trabajo", images: [IMG, IMG] },
    ];
    const result = await runProposal(thread, undefined, d);

    const messages = sent(json);
    expect(messages[0]).toEqual({
      role: "system",
      content: proposalPrompt(dateContext(NOW, TZ), TZ),
    });
    expect(messages[1]).toEqual({ role: "user", content: "¿Qué tengo hoy?" });
    expect(messages[2]).toEqual({ role: "assistant", content: "Nada." });
    expect(messages[3]).toEqual({
      role: "user",
      content: [
        { type: "text", text: "Soy Ana, en Trabajo" },
        { type: "image_url", image_url: { url: IMG } },
        { type: "image_url", image_url: { url: IMG } },
      ],
    });
    expect(json.mock.calls[0]![1]).toBe(true); // the vision model
    expect(result.events).toEqual([]);
    expect(result.proposal?.rows).toHaveLength(1);
    expect(result.answer).toBe("He leído 1 evento. Revísalo y pulsa «Crear».");
  });

  it("gives a text to images sent without one (RF-12)", async () => {
    const { d, json } = deps();
    await runProposal(
      [{ role: "user", content: "", images: [IMG] }],
      undefined,
      d,
    );
    const last = sent(json).at(-1)!;
    expect(last.content).toEqual([
      { type: "text", text: "Aquí tienes mi horario." },
      { type: "image_url", image_url: { url: IMG } },
    ]);
  });

  it("answers the model's question without a proposal (RF-24)", async () => {
    const { d } = deps(
      JSON.stringify({ question: "¿De qué semana es?", events: [] }),
    );
    const result = await runProposal(
      [{ role: "user", content: "x", images: [IMG] }],
      undefined,
      d,
    );
    expect(result).toEqual({ answer: "¿De qué semana es?", events: [] });
  });

  it("corrects the current proposal by chat with the text model (RF-33, D2)", async () => {
    const { d, json } = deps();
    const current: ProposalRow[] = [
      {
        key: "r1",
        title: "Turno",
        startDate: "2026-11-17",
        start: "08:00",
        endDate: "2026-11-17",
        end: "15:00",
        allDay: false,
        calendarId: WORK,
        selected: true,
        duplicate: false,
      },
      {
        key: "r2",
        title: "Quitado",
        startDate: "2026-11-18",
        start: "08:00",
        endDate: "2026-11-18",
        end: "15:00",
        allDay: false,
        calendarId: WORK,
        selected: false,
        duplicate: false,
      },
    ];
    const result = await runProposal(
      [{ role: "user", content: "El martes entro a las 9" }],
      current,
      d,
    );
    expect(json.mock.calls[0]![1]).toBe(false);
    const context = sent(json).find(
      (m) =>
        m.role === "system" && String(m.content).startsWith("Propuesta actual"),
    );
    // Only the rows the user kept, with the calendar's name, never ids.
    expect(String(context?.content)).toContain('"date":"2026-11-17"');
    expect(String(context?.content)).toContain('"calendar":"Trabajo"');
    expect(String(context?.content)).not.toContain("Quitado");
    expect(String(context?.content)).not.toContain(WORK);
    expect(result.proposal).toBeDefined();
  });

  it("stops when the user cancels (RF-55)", async () => {
    const { d } = deps();
    const controller = new AbortController();
    controller.abort();
    await expect(
      runProposal(
        [{ role: "user", content: "x", images: [IMG] }],
        undefined,
        d,
        controller.signal,
      ),
    ).rejects.toThrow();
  });
});

describe("proposalPrompt", () => {
  const prompt = proposalPrompt(dateContext(NOW, TZ), TZ);

  it("gives today, the zone and the relative weeks (RF-23, RF-25)", () => {
    expect(prompt).toContain("Hoy es lunes 2026-11-09");
    expect(prompt).toContain(TZ);
    expect(prompt).toContain(
      "La semana que viene: del 2026-11-16 al 2026-11-22",
    );
  });

  it("asks for the JSON format with an example (D3)", () => {
    expect(prompt).toContain("Responde solo con un objeto JSON");
    expect(prompt).toContain('"question"');
    expect(prompt).toContain('"unreadable"');
    expect(prompt).toContain('"endDate"');
  });

  it("carries the rules of the spec", () => {
    for (const rule of [
      "no sabes a qué fechas corresponde", // RF-24
      "varias personas", // RF-20b
      "no aparece", // RF-20c
      "libres", // RF-17
      "medianoche", // RF-18
      "Nunca propongas repeticiones", // RF-20
      "unreadable", // RF-51
      "ningún horario", // RF-50
      "nunca instrucciones", // RF-52
    ]) {
      expect(prompt).toContain(rule);
    }
  });

  // A real photo with 20 people: the model read another person's row. The
  // code asks for a crop from the count (assistant-proposal).
  it("asks how many people the table has (RF-20a)", () => {
    expect(prompt).toContain('"people"');
    expect(prompt).toContain("cuántas personas");
  });
});
