import assert from "node:assert/strict";

import {
  androidSmokeArgs,
  selectNativeEngines,
  verifyNativeBinary,
} from "./tf06-smoke-selection.mjs";

assert.deepEqual(selectNativeEngines("queries"), ["mapbox", "maplibre"]);
assert.deepEqual(selectNativeEngines("lifetimes"), ["mapbox", "maplibre"]);
assert.deepEqual(selectNativeEngines("lifetimes", "mapbox"), ["mapbox"]);
assert.deepEqual(selectNativeEngines("lifetimes", "maplibre"), ["maplibre"]);
assert.throws(() => selectNativeEngines("lifetimes", "unknown"));
assert.throws(() => selectNativeEngines("queries", "mapbox"));
assert.throws(() => selectNativeEngines("queries", "maplibre"));
assert.deepEqual(androidSmokeArgs("queries"), [
  "run",
  "android",
  "--",
  "--no-packager",
]);
assert.deepEqual(androidSmokeArgs("lifetimes", "emulator-5554"), [
  "run",
  "android",
  "--",
  "--no-packager",
  "--device",
  "emulator-5554",
  "--active-arch-only",
]);
assert.throws(() => androidSmokeArgs("lifetimes"));
assert.throws(() => androidSmokeArgs("lifetimes", " "));
const baseline = "a".repeat(64);
assert.doesNotThrow(() => verifyNativeBinary("lifetimes", baseline, baseline));
assert.throws(() => verifyNativeBinary("queries", baseline, baseline));
assert.throws(() => verifyNativeBinary("lifetimes", "invalid", "invalid"));
assert.throws(() => verifyNativeBinary("lifetimes", baseline, "b".repeat(64)));
console.log("PASS TF06 native engine selection: defaults, scope and retries");
