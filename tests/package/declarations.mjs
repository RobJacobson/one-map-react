import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

/** Checks all emitted declaration imports, including ones skipped by TypeScript's skipLibCheck. */
export const walkDeclarations = (file, forbidden, seen = new Set()) => {
  const declaration = file.endsWith(".d.ts")
    ? file
    : file.replace(/\.js$/, ".d.ts");
  if (seen.has(declaration)) return;
  seen.add(declaration);

  const text = readFileSync(declaration, "utf8");
  const specifiers = [
    ...text.matchAll(/(?:from|import)\s*["']([^"']+)["']/g),
    ...text.matchAll(/import\(["']([^"']+)["']\)/g),
  ].map((match) => match[1]);

  for (const specifier of specifiers) {
    for (const backend of forbidden) {
      assert.ok(
        specifier !== backend && !specifier.startsWith(`${backend}/`),
        `${declaration} imports ${specifier}`
      );
    }
    if (specifier.startsWith(".")) {
      walkDeclarations(
        resolve(dirname(declaration), specifier),
        forbidden,
        seen
      );
    }
  }
};
