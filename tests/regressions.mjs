import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

// Vitest and Jest do not own these process, compiler, and peer-source checks.
const regressions = [
  ["node", "tests/docs.test.mjs"],
  ["bun", "tests/example/fixture-base.test.mjs"],
  ["bun", "tests/peers/patches.test.mjs"],
  ["node", "tests/peers/offline-manager.test.mjs"],
  ["node", "tests/lint-policy.test.mjs"],
  ["node", "tests/peers/terrain.test.mjs"],
  ["bun", "tests/package/options.test.mjs"],
  ["bun", "tests/peers/mapbox-version.test.mjs"],
  ["node", "tests/example/config.test.mjs"],
  ["node", "tests/example/native-codegen.test.mjs"],
  ["bun", "tests/example/orientation.test.mjs"],
  ["node", "tests/peers/location-observer.test.mjs"],
  ["node", "tests/peers/offline-status.test.mjs"],
  ["node", "tests/peers/light-color.test.mjs"],
  ["node", "tests/peers/source-lifetime.test.mjs"],
  ["bun", "tests/example/camera-observer.test.mjs"],
  ["node", "tests/peers/camera-bounds-reset.test.mjs"],
  ["bun", "tests/peers/camera-mode.test.mjs"],
];

for (const [command, file] of regressions) {
  const result = spawnSync(command, [file], { cwd: root, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
