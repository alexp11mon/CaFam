import { writeFileSync } from "node:fs";
import ts from "typescript";
import { it } from "vitest";
import { looksSpanish, sources } from "./i18n-scan";
import { NOT_SHOWN } from "./i18n-pending";

// TEMPLATES_OUT=<file>: Spanish template literals with ${} (scratch listing).
it.runIf(process.env.TEMPLATES_OUT)("lists Spanish templates", () => {
  const out: string[] = [];
  for (const { file, sf } of sources()) {
    if (NOT_SHOWN.some((p) => file.startsWith(p))) continue;
    const visit = (node: ts.Node) => {
      if (ts.isTemplateExpression(node)) {
        const parts = [
          node.head.text,
          ...node.templateSpans.map((s) => s.literal.text),
        ];
        if (parts.some((p) => looksSpanish(p) || /[áéíóúñ¿¡«»]/.test(p)))
          out.push(
            `${file}:${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1}: ${node.getText(sf).slice(0, 140)}`,
          );
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  writeFileSync(process.env.TEMPLATES_OUT!, out.join("\n"));
});
