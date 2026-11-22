import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  nativeMapboxSdkVersion,
  pinNativeMapboxVersion,
} from "./native-mapbox-version.mjs";

const podfile =
  "platform :ios, '15.0'\ntarget 'Example' do\n  use_native_modules!\nend\n";
const buildGradle =
  "buildscript {\n    ext {\n        minSdkVersion = 24\n    }\n}\n";
const result = pinNativeMapboxVersion(podfile, buildGradle);
assert.match(result.podfile, /^\$RNMapboxMapsVersion = '= 11\.33\.0'\n/);
assert.match(
  result.buildGradle,
  /ext \{\n        RNMapboxMapsVersion = '11\.33\.0'/
);
assert(result.podfile.endsWith(podfile));
assert(result.buildGradle.includes("minSdkVersion = 24"));
assert.deepEqual(
  pinNativeMapboxVersion(result.podfile, result.buildGradle),
  result
);
assert.deepEqual(
  pinNativeMapboxVersion(
    "$RNMapboxMapsVersion = '~> 11.23.1'\n" + podfile,
    "buildscript {\n    ext {\n        RNMapboxMapsVersion = '10.19.0'\n        minSdkVersion = 24\n    }\n}\n"
  ),
  result
);
assert.throws(
  () => pinNativeMapboxVersion(podfile, "invalid template"),
  /buildscript.ext/
);
const wrapper = JSON.parse(
  readFileSync(
    new URL("../node_modules/@rnmapbox/maps/package.json", import.meta.url),
    "utf8"
  )
);
assert.equal(wrapper.mapbox.ios, `~> ${nativeMapboxSdkVersion}`);
assert.equal(wrapper.mapbox.android, nativeMapboxSdkVersion);
const wrapperGradle = readFileSync(
  new URL(
    "../node_modules/@rnmapbox/maps/android/build.gradle",
    import.meta.url
  ),
  "utf8"
);
assert.match(wrapperGradle, /rootProject\.ext\.has\(prop\)/);
assert.match(
  wrapperGradle,
  /safeExtGet\("RNMapboxMapsVersion", defaultMapboxMapsVersion\)/
);
console.log(
  "PASS native Mapbox SDK pin: exact public settings, idempotence, replacement, malformed template and installed wrapper agreement; no native build"
);
