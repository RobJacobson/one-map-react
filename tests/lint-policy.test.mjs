import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const output = mkdtempSync(join(tmpdir(), "one-map-lint-policy-"));
const fixtures = {
  "equality.ts": "export const equal = (a: unknown, b: unknown) => a == b;",
  "arrow.ts": "export const value = function () { return 1; };",
  "shadow.ts": "export const Map = 1;",
  "shadow-class.ts": "export class Map {}",
  "shadow-parameter.ts": "export const value = (Set: unknown) => Set;",
  "property-name.ts":
    "export const value = function () { return { arguments: 1 }; };",
  "unused.ts": 'import { join } from "node:path"; export const value = 1;',
  "rest.ts":
    "export const forward = (props: { hostProps: object; value: number }) => { const { hostProps, ...rest } = props; return rest; };",
  "valid.ts": `
    export const equal = (a: unknown) => a == null;
    export const dynamic = function () { return this.value; };
    export const args = function () { return arguments[0]; };
    export const named = function recurse() { return recurse; };
    export const generator = function* () { yield 1; };
    export const typed = function (this: { value: number }) { return this.value; };
    export const arrow = () => new Map();
    export const methods = { value() { return 1; } };
    export const parent = function () { return () => this.value; };
    export interface Map { value: number }
    export type Set = string;
  `,
  "nested.ts":
    "export const outer = function () { return function inner() { return this.value; }; };",
  "hook.tsx":
    'import { useEffect } from "react"; export const useValue = (value: number) => { useEffect(() => console.log(value), []); };',
};

try {
  for (const [name, code] of Object.entries(fixtures)) {
    writeFileSync(join(output, name), code);
  }
  const result = spawnSync(
    join(root, "node_modules/.bin/vp"),
    ["lint", output, "--format=json"],
    { cwd: root, encoding: "utf8" }
  );
  if (result.error) throw result.error;
  assert.equal(result.status, 1, result.stderr);
  const { diagnostics } = JSON.parse(result.stdout);
  const codes = (name) =>
    diagnostics
      .filter((diagnostic) => basename(diagnostic.filename) === name)
      .map((diagnostic) => diagnostic.code);
  assert.deepEqual(codes("equality.ts"), ["eslint(eqeqeq)"]);
  assert.deepEqual(codes("arrow.ts"), ["one-map(use-arrow-functions)"]);
  assert.deepEqual(codes("nested.ts"), ["one-map(use-arrow-functions)"]);
  assert.deepEqual(codes("shadow.ts"), ["one-map(no-shadow-language-globals)"]);
  assert.deepEqual(codes("shadow-class.ts"), [
    "one-map(no-shadow-language-globals)",
  ]);
  assert.deepEqual(codes("shadow-parameter.ts"), [
    "one-map(no-shadow-language-globals)",
  ]);
  assert.deepEqual(codes("unused.ts"), ["eslint(no-unused-vars)"]);
  assert.deepEqual(codes("property-name.ts"), ["one-map(use-arrow-functions)"]);
  assert.deepEqual(codes("rest.ts"), []);
  assert.deepEqual(codes("valid.ts"), []);
  assert.deepEqual(codes("hook.tsx"), ["react-hooks(exhaustive-deps)"]);
  console.log(
    "PASS lint policy: unsafe equality, arrow expressions, global bindings, unused imports, prop omission, and hook dependencies."
  );
} finally {
  rmSync(output, { recursive: true, force: true });
}
