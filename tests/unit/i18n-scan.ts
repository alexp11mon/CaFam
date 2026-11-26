import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";

// Spec 053 T2 (RF-8): reads the sources to find the texts of the interface.
// Shared by i18n-complete and i18n-no-literals.

const ROOT = join(__dirname, "../..");

/** Names and symbols that read the same in both languages. */
export const NAMES =
  /^(CaFam|Google|iCloud|Venito|Nexo|Groq|Brevo|Supabase|Vercel|GitHub|Apple|Chrome|Safari|Edge|Android|iPhone|iOS|PWA|ICS|\.ics|OK|ID|PIN|Web Push|Google Calendar|CalDAV|VAPID|URL|Email|Inter|English|Español|·|—|–|-|\+|×|\/|:|,|\.|…|\?|!|%|\(|\)|\d+|[A-Z])$/;

/** Attributes that people read or hear. */
export const TEXT_ATTRIBUTES = new Set([
  "aria-label",
  "placeholder",
  "title",
  "label",
  "alt",
  "description",
  "hint",
  "aria-description",
  "aria-valuetext",
  "aria-roledescription",
]);

const STOP =
  /\b(el|la|los|las|de|del|un|una|que|con|para|por|sin|tu|tus|no|se|en|es|al|ya|hay|y|o|a|su|sus|lo|te|mi|más|este|esta|esto)\b/i;

const hasLetters = (text: string) => /[A-Za-zÀ-ÿ]/.test(text);
export const isVisible = (text: string) =>
  hasLetters(text) && !NAMES.test(text.trim());

/** A literal that reads as Spanish for people (not ids, paths, CSS…). */
export function looksSpanish(text: string): boolean {
  const s = text.trim();
  if (!isVisible(s)) return false;
  if (/^[\w-]+(\/[\w-]+)+$/.test(s) || /^[a-z0-9_.:-]+$/.test(s)) return false;
  if (/[{}<>=;]|^\/|https?:|\.(tsx?|svg|png|jpe?g|ics|json)\b/.test(s))
    return /[áéíóúñ¿¡«»…]/i.test(s) && /[{}]/.test(s) && !/[<>=;]/.test(s);
  if (/[áéíóúñ¿¡«»…]/i.test(s)) return true;
  return / /.test(s) && STOP.test(s) && /^[A-ZÁÉÍÓÚÑ¿¡«"(]/.test(s);
}

/** React's rules for the whitespace of JSX text. */
export function cleanJsxText(text: string): string {
  const lines = text.split(/\r\n|\n|\r/);
  let last = 0;
  lines.forEach((line, i) => {
    if (/[^ \t]/.test(line)) last = i;
  });
  let out = "";
  lines.forEach((raw, i) => {
    let line = raw.replace(/\t/g, " ");
    if (i !== 0) line = line.replace(/^[ ]+/, "");
    if (i !== lines.length - 1) line = line.replace(/[ ]+$/, "");
    if (line) out += i !== last ? `${line} ` : line;
  });
  return out;
}

export type Source = { file: string; sf: ts.SourceFile };

function walk(dir: string, out: string[]) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, out);
    else if (/\.tsx?$/.test(entry.name)) out.push(path);
  }
  return out;
}

let cached: Source[] | null = null;
export function sources(): Source[] {
  cached ??= walk(join(ROOT, "src"), [])
    .map((path) => ({
      file: relative(ROOT, path).replace(/\\/g, "/"),
      path,
    }))
    .filter(({ file }) => file !== "src/types/database.ts")
    .map(({ file, path }) => ({
      file,
      sf: ts.createSourceFile(
        file,
        readFileSync(path, "utf8"),
        ts.ScriptTarget.Latest,
        true,
        file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
      ),
    }));
  return cached;
}

function each(node: ts.Node, visit: (node: ts.Node) => void) {
  visit(node);
  ts.forEachChild(node, (child) => each(child, visit));
}

const literalText = (node: ts.Node) =>
  ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)
    ? node.text
    : null;

/** Texts passed to t(), plural() and <T>: the keys the catalog must have. */
export function translatedTexts(): Map<string, string> {
  const keys = new Map<string, string>();
  for (const { file, sf } of sources()) {
    // Only the plural() of the catalog; some modules have one of their own.
    const ownPlural = sf.text.includes('"@/lib/i18n/plural"');
    each(sf, (node) => {
      if (ts.isCallExpression(node)) {
        const callee = node.expression.getText(sf);
        const args =
          callee === "t" || callee === "spanishT"
            ? node.arguments.slice(0, 1)
            : callee === "plural" && ownPlural
              ? node.arguments.slice(1, 3)
              : [];
        for (const arg of args) {
          const text = literalText(arg);
          if (text !== null) keys.set(text, file);
        }
      }
      if (
        ts.isJsxElement(node) &&
        node.openingElement.tagName.getText(sf) === "T"
      ) {
        for (const child of node.children) {
          const text = ts.isJsxExpression(child)
            ? child.expression && literalText(child.expression)
            : ts.isJsxText(child)
              ? cleanJsxText(child.text).trim() || null
              : null;
          if (text) keys.set(text, file);
        }
      }
    });
  }
  return keys;
}

/** Every string literal of the sources, to find unused catalog entries. */
export function allLiterals(): Set<string> {
  const all = new Set<string>();
  for (const { sf } of sources()) {
    each(sf, (node) => {
      const text = literalText(node);
      if (text !== null) all.add(text);
    });
  }
  return all;
}

/** Spanish shown without t() or <T>, with the file and line. */
export function strayTexts(): { file: string; line: number; text: string }[] {
  const found: { file: string; line: number; text: string }[] = [];
  for (const { file, sf } of sources()) {
    if (!file.endsWith(".tsx")) continue;
    const add = (node: ts.Node, text: string) =>
      found.push({
        file,
        line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
        text: text.slice(0, 60),
      });
    each(sf, (node) => {
      if (ts.isJsxText(node)) {
        const parent = node.parent;
        const inT =
          ts.isJsxElement(parent) &&
          parent.openingElement.tagName.getText(sf) === "T";
        const text = cleanJsxText(node.text).trim();
        if (!inT && isVisible(text)) add(node, text);
      }
      if (
        ts.isJsxAttribute(node) &&
        TEXT_ATTRIBUTES.has(node.name.getText(sf)) &&
        node.initializer
      ) {
        const init = ts.isJsxExpression(node.initializer)
          ? node.initializer.expression
          : node.initializer;
        const text = init && literalText(init);
        if (text && isVisible(text)) add(node, text);
        if (
          init &&
          ts.isTemplateExpression(init) &&
          looksSpanish(init.head.text)
        )
          add(node, init.getText(sf));
      }
    });
  }
  return found;
}

/** Spanish literals of modules (messages, labels) that need an English entry. */
export function spanishLiterals(): { file: string; text: string }[] {
  const found: { file: string; text: string }[] = [];
  for (const { file, sf } of sources()) {
    each(sf, (node) => {
      const text = literalText(node);
      if (text === null || !looksSpanish(text)) return;
      const parent = node.parent;
      // Not shown: directives, property names, comparisons, imports, types.
      if (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent))
        return;
      if (ts.isLiteralTypeNode(parent)) return;
      if (ts.isPropertyAssignment(parent) && parent.name === node) return;
      if (
        ts.isBinaryExpression(parent) &&
        /^(===|!==|==|!=)$/.test(parent.operatorToken.getText(sf))
      )
        return;
      found.push({ file, text });
    });
  }
  return found;
}
