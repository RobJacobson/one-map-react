import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const checker = resolve(import.meta.dirname, "../scripts/check-docs.mjs");
const cwd = mkdtempSync(join(tmpdir(), "one-map-docs-"));
const write = (file, contents) => writeFileSync(join(cwd, file), contents);
const check = () =>
  spawnSync(process.execPath, [checker], { cwd, encoding: "utf8" });

try {
  execFileSync("git", ["init", "--quiet"], { cwd });
  mkdirSync(join(cwd, "apps/expo"), { recursive: true });
  mkdirSync(join(cwd, "artifacts"));
  mkdirSync(join(cwd, "docs"));
  write(".gitignore", "artifacts/\n");
  write("artifacts/README.md", "[Ignored output](missing.md)\n");
  write("docs/guide.md", "# Setup\n");
  write("README.md", "# Project\n\n[Setup](docs/guide.md#missing)\n");
  execFileSync("git", ["add", ".gitignore", "README.md", "docs/guide.md"], {
    cwd,
  });
  write("apps/expo/AGENTS.md", "[Project](../../README.md#missing)\n");

  const broken = check();
  assert.equal(broken.status, 1, broken.stdout + broken.stderr);
  assert.match(broken.stderr, /README\.md:3: Missing local heading/);
  assert.match(
    broken.stderr,
    /apps\/expo\/AGENTS\.md:1: Missing local heading/
  );

  write("README.md", "# Project\n\n[Setup](docs/guide.md#setup)\n");
  write("apps/expo/AGENTS.md", "[Project](../../README.md#project)\n");
  const fixed = check();
  assert.equal(fixed.status, 0, fixed.stdout + fixed.stderr);
  assert.match(fixed.stdout, /3 Markdown files/);
} finally {
  rmSync(cwd, { recursive: true, force: true });
}
