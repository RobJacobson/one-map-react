import assert from "node:assert/strict";

import { foregroundLocationDeclarations } from "./native-location-permissions.mjs";

const plist =
  "<plist><dict><key>name</key><string>fixture</string></dict></plist>";
const manifest =
  '<manifest xmlns:android="http://schemas.android.com/apk/res/android"><application /></manifest>';
const result = foregroundLocationDeclarations(plist, manifest);
assert.match(result.plist, /NSLocationWhenInUseUsageDescription/);
assert.match(result.manifest, /android.permission.ACCESS_COARSE_LOCATION/);
assert.match(result.manifest, /android.permission.ACCESS_FINE_LOCATION/);
assert.deepEqual(
  foregroundLocationDeclarations(result.plist, result.manifest),
  result
);
const custom = result.plist.replace(
  "Show your location and follow it on the map when you choose Locate.",
  "Application explanation"
);
assert.equal(
  foregroundLocationDeclarations(custom, result.manifest).plist,
  custom
);
assert.throws(
  () => foregroundLocationDeclarations("<plist />", manifest),
  /dictionary/
);
assert.throws(
  () => foregroundLocationDeclarations(plist, "<manifest />"),
  /application/
);
console.log(
  "PASS TF08 native permission declarations: foreground-only setup, existing text, idempotence, and malformed-template failures; no native project generation or build."
);
