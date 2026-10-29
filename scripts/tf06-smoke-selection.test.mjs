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
assert.throws(() => selectNativeEngines("queries", "unknown"));
assert.throws(() => selectNativeEngines("unknown", "maplibre"));
assert.deepEqual(selectNativeEngines("queries", "mapbox"), ["mapbox"]);
assert.deepEqual(selectNativeEngines("queries", "maplibre"), ["maplibre"]);
for (const scope of ["queries", "lifetimes"]) {
  assert.deepEqual(androidSmokeArgs(scope, "emulator-5580"), [
    "run",
    "android",
    "--",
    "--no-packager",
    "--device",
    "emulator-5580",
    "--active-arch-only",
  ]);
  assert.throws(() => androidSmokeArgs(scope));
  assert.throws(() => androidSmokeArgs(scope, " "));
}
const baseline = "a".repeat(64);
assert.doesNotThrow(() => verifyNativeBinary("lifetimes", baseline, baseline));
assert.throws(() => verifyNativeBinary("queries", baseline, baseline));
assert.throws(() => verifyNativeBinary("lifetimes", "invalid", "invalid"));
assert.throws(() => verifyNativeBinary("lifetimes", baseline, "b".repeat(64)));
console.log("PASS TF06 native engine selection: defaults, scope and retries");
