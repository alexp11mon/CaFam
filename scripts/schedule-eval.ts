import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { jsonChat, visionChat } from "@/lib/assistant/provider";
import { runProposal } from "@/lib/assistant/run";
import {
  CASES,
  EVAL_NOW,
  type ExpectedRow,
  type ScheduleCase,
} from "../tests/fixtures/schedules/cases";

// Spec 022, T11: `npm run eval:schedule`. Sends every synthetic schedule to
// the real vision model (Groq) and scores the proposal (plan D10). No
// database: the user has one writable calendar, "Trabajo", and no events.
// Not part of `npm test`: it needs the network and spends the shared quota.

const TZ = "Europe/Madrid";
// ITPM is 7,000 for the vision model and an image is about 1,600 tokens.
const PAUSE_MS = 60_000;
const LATENCY_MS = 20_000;
const DIR = join(process.cwd(), "tests/fixtures/schedules");

// EVAL_ONLY=3-5 runs only those cases (1-based, inclusive).
const [onlyFrom, onlyTo] = (process.env.EVAL_ONLY ?? "").split("-").map(Number);
const selected = CASES.map((c, i) => ({ c, n: i + 1 })).filter(
  ({ n }) => !onlyFrom || (n >= onlyFrom && n <= (onlyTo || onlyFrom)),
);

/** Cases sharing a schedule share the image of the first one. */
function imageOf(target: ScheduleCase): string {
  const owner = CASES.find((c) => c.html === target.html)!;
  const bytes = readFileSync(join(DIR, `${owner.id}.jpg`));
  return `data:image/jpeg;base64,${bytes.toString("base64")}`;
}

const key = (r: ExpectedRow) =>
  `${r.date} ${r.start ?? "día"}-${r.end ?? "completo"} ${r.endDate ?? r.date}`;

/** Rows right over the larger of expected and proposed (extra rows count). */
function score(expected: ScheduleCase["expected"], got: ExpectedRow[] | null) {
  if (expected === "message") return { right: got ? 0 : 1, total: 1 };
  if (!got) return { right: 0, total: expected.length };
  const left = got.map(key);
  let right = 0;
  for (const row of expected) {
    const at = left.indexOf(key(row));
    if (at !== -1) {
      right += 1;
      left.splice(at, 1);
    }
  }
  return { right, total: Math.max(expected.length, got.length) };
}

it(
  "reads the synthetic schedules (spec 022 RNF calidad y tiempo)",
  { timeout: (selected.length + 1) * (PAUSE_MS + 30_000) },
  async () => {
    let right = 0;
    let total = 0;
    let fast = 0;
    const lines: string[] = [];
    for (const [index, { c, n }] of selected.entries()) {
      if (index > 0) await new Promise((r) => setTimeout(r, PAUSE_MS));
      const started = Date.now();
      let got: ExpectedRow[] | null = null;
      let note: string;
      try {
        const answer = await runProposal(
          [{ role: "user", content: c.message, images: [imageOf(c)] }],
          undefined,
          {
            json: (messages, vision, signal) =>
              vision
                ? visionChat(messages, signal)
                : jsonChat(messages, undefined, signal),
            proposal: {
              calendars: [
                {
                  id: "00000000-0000-4000-8000-000000000001",
                  name: "Trabajo",
                  canWrite: true,
                },
              ],
              timeZone: TZ,
              loadEvents: async () => [],
            },
            now: EVAL_NOW,
            timeZone: TZ,
          },
        );
        got =
          answer.proposal?.rows.map((r) => ({
            date: r.startDate,
            start: r.allDay ? null : r.start,
            end: r.allDay ? null : r.end,
            ...(r.endDate !== r.startDate ? { endDate: r.endDate } : {}),
          })) ?? null;
        note = answer.answer.replace(/\s+/g, " ").slice(0, 120);
      } catch (error) {
        note = `ERROR ${(error as Error).message}`;
      }
      const ms = Date.now() - started;
      if (ms <= LATENCY_MS) fast += 1;
      const s = score(c.expected, got);
      right += s.right;
      total += s.total;
      lines.push(
        `${String(n).padStart(2)} ${c.id.padEnd(20)} ${s.right}/${s.total} ${(ms / 1000).toFixed(1)} s · ${c.about}\n     ${got ? got.map(key).join(" | ") : "(sin propuesta)"}\n     ${note}`,
      );
    }
    const accuracy = right / total;
    const fastShare = fast / selected.length;
    console.log(
      `${lines.join("\n")}\n\nFilas bien: ${right}/${total} (${(accuracy * 100).toFixed(0)} %) · En ${LATENCY_MS / 1000} s o menos: ${fast}/${selected.length} (${(fastShare * 100).toFixed(0)} %)`,
    );
    expect(accuracy).toBeGreaterThanOrEqual(0.9);
    expect(fastShare).toBeGreaterThanOrEqual(0.9);
  },
);
