import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import process from "node:process";

const runPeer = (
  file: string,
  ci: string,
  compiler = "",
  args: string[] = []
) =>
  spawnSync(process.execPath, [file, ...args], {
    env: { ...process.env, CI: ci, ONE_MAP_KOTLINC: compiler },
    encoding: "utf8",
    timeout: 60_000,
  });

const sourceLifetime = "tests/peers/source-lifetime.test.mjs";
const peerScripts = [sourceLifetime];
if (process.platform === "darwin") {
  peerScripts.push("tests/peers/camera-bounds-reset.test.mjs");
}

for (const file of peerScripts) {
  const required = runPeer(file, "true");
  if (required.error) throw required.error;
  assert.equal(required.status, 1, required.stdout + required.stderr);
  assert.match(required.stderr, /ONE_MAP_KOTLINC is required in CI/);
}

const optional = runPeer(sourceLifetime, "false", "", [
  "mapbox",
  "node_modules/@rnmapbox/maps",
  process.execPath,
]);
if (optional.error) throw optional.error;
assert.equal(optional.status, 0, optional.stderr);
assert.match(optional.stdout, /PASS native explicit-state/);
assert.match(
  optional.stdout,
  /SKIP Kotlin regression: ONE_MAP_KOTLINC is unset/
);

const invalid = runPeer(sourceLifetime, "false", process.execPath);
if (invalid.error) throw invalid.error;
assert.equal(invalid.status, 1, invalid.stdout + invalid.stderr);
assert.match(invalid.stderr, /Kotlin compilation failed/);
