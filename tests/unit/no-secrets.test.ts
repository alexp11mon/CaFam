import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

// Constitution P4: server-only secrets must never appear in app code.
const FORBIDDEN_PATTERNS = ["SUPABASE_SECRET_KEY", "service_role"];
const SRC_DIR = join(process.cwd(), "src");

function listFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(dir, entry.name);
    return entry.isDirectory() ? listFiles(fullPath) : [fullPath];
  });
}

const FILES = listFiles(SRC_DIR).map((file) => ({
  path: relative(SRC_DIR, file).split(sep).join("/"),
  content: readFileSync(file, "utf8"),
}));

describe("no secrets in src/", () => {
  it("contains no reference to server-only secrets", () => {
    const offenders = FILES.flatMap(({ path, content }) =>
      FORBIDDEN_PATTERNS.filter((pattern) => content.includes(pattern)).map(
        (pattern) => `${path}: ${pattern}`,
      ),
    );

    expect(offenders).toEqual([]);
  });
});

// Spec 007, T14: the OAuth client secret, the cron secret and the refresh
// tokens stay on the server; since spec 040, also the VAPID private key.
const SERVER_SECRETS = [
  "GOOGLE_CLIENT_SECRET",
  "CRON_SECRET",
  "VAPID_PRIVATE_KEY",
];
const isClient = (content: string) => /^\s*["']use client["']/.test(content);

/** `@/…` and relative imports of a file, as paths inside src/ without extension. */
function importsOf(path: string, content: string): string[] {
  const dir = path.split("/").slice(0, -1);
  return [...content.matchAll(/from\s+["']([^"']+)["']/g)].flatMap(
    ([, spec]) => {
      if (spec.startsWith("@/")) return [spec.slice(2)];
      if (!spec.startsWith(".")) return [];
      const parts = [...dir];
      for (const part of spec.split("/")) {
        if (part === "..") parts.pop();
        else if (part !== ".") parts.push(part);
      }
      return [parts.join("/")];
    },
  );
}

const withoutExtension = (path: string) => path.replace(/\.tsx?$/, "");

describe("spec 007 secrets (T14)", () => {
  it("never exposes the server secrets with NEXT_PUBLIC_", () => {
    const pattern =
      /NEXT_PUBLIC_\w*(GOOGLE_CLIENT_SECRET|CRON_SECRET|VAPID_PRIVATE_KEY)/;
    expect(
      FILES.filter(({ content }) => pattern.test(content)).map((f) => f.path),
    ).toEqual([]);
  });

  it("reads them only in server code that no client component imports", () => {
    const holders = FILES.filter(({ content }) =>
      SERVER_SECRETS.some((secret) => content.includes(secret)),
    );
    expect(holders.length).toBeGreaterThan(0);
    expect(
      holders.filter(({ content }) => isClient(content)).map((f) => f.path),
    ).toEqual([]);

    const holderPaths = new Set(holders.map((f) => withoutExtension(f.path)));
    const leaks = FILES.filter(({ content }) => isClient(content)).flatMap(
      ({ path, content }) =>
        importsOf(path, content)
          .filter((target) => holderPaths.has(target))
          .map((target) => `${path} -> ${target}`),
    );
    expect(leaks).toEqual([]);
  });

  it("handles refresh tokens only in the provider client and the server sync code", () => {
    // The callback stores the new token, the engine stores a rotated one, and
    // database.ts is the generated schema of the RPC arguments.
    const allowed = [
      "lib/sync/providers/google.ts",
      "app/api/oauth/[provider]/callback/route.ts",
      // Spec 018 T3: the token renewal moved from run-sync.ts to deps.ts.
      "lib/sync/deps.ts",
      // Spec 018 D3: the iCloud credential goes to Vault in p_refresh_token.
      "app/dashboard/connections/actions.ts",
      "types/database.ts",
    ];
    const mentions = FILES.filter(({ content }) =>
      /refresh_?token/i.test(content),
    ).map((f) => f.path);

    expect(mentions.filter((path) => !allowed.includes(path))).toEqual([]);
    expect(
      FILES.filter(
        ({ path, content }) => allowed.includes(path) && isClient(content),
      ),
    ).toEqual([]);
  });
});

// Spec 013, T5: ical.js stays on the server (plan R7).
describe("spec 013 recurrence expansion (T5)", () => {
  it("ical.js is imported only by the .ics parser, the expansion and iCloud's .ics (spec 018)", () => {
    expect(
      FILES.filter(({ content }) => /from\s+["']ical\.js["']/.test(content))
        .map((f) => f.path)
        .sort(),
    ).toEqual([
      "lib/ics/parse-ics.ts",
      "lib/recurrence/expand.ts",
      "lib/sync/icloud-ics.ts",
    ]);
  });

  it("no client component imports the expansion", () => {
    const leaks = FILES.filter(({ content }) => isClient(content)).flatMap(
      ({ path, content }) =>
        importsOf(path, content.replace(/import\s+type\s[^;]*;/g, ""))
          .filter((target) => target === "lib/recurrence/expand")
          .map((target) => `${path} -> ${target}`),
    );
    expect(leaks).toEqual([]);
  });
});

// Spec 035 D2: the offline series overlay expands rules in the browser, but
// ical.js only arrives with import(), never in the static graph of a client
// component (plan R5).
describe("spec 035 lazy expansion (T2)", () => {
  const known = new Set(FILES.map(({ path }) => withoutExtension(path)));
  const resolve = (target: string) =>
    known.has(target)
      ? target
      : known.has(`${target}/index`)
        ? `${target}/index`
        : null;
  const staticImports = new Map(
    FILES.map(({ path, content }) => [
      withoutExtension(path),
      importsOf(path, content.replace(/import\s+type\s[^;]*;/g, ""))
        .map(resolve)
        .filter((target): target is string => target !== null),
    ]),
  );

  const serverActions = new Set(
    FILES.filter(({ content }) => /^\s*["']use server["']/.test(content)).map(
      ({ path }) => withoutExtension(path),
    ),
  );

  it("no client component reaches expand.ts without import()", () => {
    const seen = new Set<string>();
    const queue = FILES.filter(({ content }) => isClient(content)).map(
      ({ path }) => withoutExtension(path),
    );
    while (queue.length > 0) {
      const next = queue.pop()!;
      if (seen.has(next)) continue;
      seen.add(next);
      // A Server Action module reaches the client as a reference, not code.
      if (serverActions.has(next)) continue;
      queue.push(...(staticImports.get(next) ?? []));
    }
    expect(seen.has("lib/recurrence/expand")).toBe(false);
    expect(seen.has("lib/offline/series-overlay")).toBe(false);
  });

  it("the overlay is the offline module that expands rules", () => {
    expect(staticImports.get("lib/offline/series-overlay")).toContain(
      "lib/recurrence/read-series",
    );
  });
});

// Spec 009, T13: the write engine runs only on the server; client components
// reach it through Server Actions, never by importing it.
describe("spec 009 write engine (T13)", () => {
  it("is not imported by any client component", () => {
    const serverOnly = [
      "lib/sync/write-event",
      "lib/sync/write-calendar",
      "lib/sync/upload-calendar",
      "lib/sync/engine",
      "lib/sync/providers/google",
    ];
    const leaks = FILES.filter(({ content }) => isClient(content)).flatMap(
      ({ path, content }) =>
        // `import type` is erased at build time, so it ships nothing.
        importsOf(path, content.replace(/import\s+type\s[^;]*;/g, ""))
          .filter((target) => serverOnly.includes(target))
          .map((target) => `${path} -> ${target}`),
    );
    expect(leaks).toEqual([]);
  });
});

// Spec 018, T14: the CalDAV client and the iCloud password stay on the server.
describe("spec 018 iCloud (T14)", () => {
  it("tsdav is imported only by the iCloud provider", () => {
    expect(
      FILES.filter(({ content }) => /from\s+["']tsdav["']/.test(content)).map(
        (f) => f.path,
      ),
    ).toEqual(["lib/sync/providers/icloud.ts"]);
  });

  it("no client component imports the iCloud provider or its credential", () => {
    const leaks = FILES.filter(({ content }) => isClient(content)).flatMap(
      ({ path, content }) =>
        /from\s+["'][^"']*(providers\/icloud|icloud-credentials|icloud-ics)["']/.test(
          content,
        )
          ? [path]
          : [],
    );
    expect(leaks).toEqual([]);
  });
});

// Spec 015, T1: the Groq key is read only by the assistant's provider client
// (plan assistant-provider, P4).
describe("spec 015 assistant key (T1)", () => {
  it("never exposes GROQ_API_KEY with NEXT_PUBLIC_", () => {
    expect(
      FILES.filter(({ content }) =>
        /NEXT_PUBLIC_\w*GROQ_API_KEY/.test(content),
      ).map((f) => f.path),
    ).toEqual([]);
  });

  it("reads GROQ_API_KEY only in the provider client, which no client component imports", () => {
    const holders = FILES.filter(({ content }) =>
      content.includes("GROQ_API_KEY"),
    );
    expect(
      holders
        .map((f) => f.path)
        .filter((path) => path !== "lib/assistant/provider.ts"),
    ).toEqual([]);

    const leaks = FILES.filter(({ content }) => isClient(content)).filter(
      ({ path, content }) =>
        importsOf(path, content.replace(/import\s+type\s[^;]*;/g, "")).includes(
          "lib/assistant/provider",
        ),
    );
    expect(leaks.map((f) => f.path)).toEqual([]);
  });
});
