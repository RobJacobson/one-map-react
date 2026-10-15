import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { runInNewContext } from "node:vm";

import { transformSync } from "@babel/core";

const root = resolve(import.meta.dirname, "..");
const rnRoot = resolve(root, "node_modules/@rnmapbox/maps");
const mlRoot = resolve(root, "node_modules/@maplibre/maplibre-react-native");

// Helpers precede the eager checks so their const bindings are initialized.
/** Extracts one native operation so assertions cannot match unrelated methods. */
const nativeSection = (source, start, end) => {
  const first = source.indexOf(start);
  const last = source.indexOf(end, first + start.length);
  assert.ok(first >= 0 && last > first, `Native section missing: ${start}`);
  return source.slice(first, last);
};

/** Verifies shipped patches reconstruct the inspected installed peer files. */
const verifyPeerPatch = (peerRoot, filename) => {
  const patchFile = resolve(root, "packages/one-map-react/patches", filename);
  const patch = readFileSync(patchFile, "utf8");
  const files = [...patch.matchAll(/^diff --git a\/(.+) b\//gm)].map(
    (match) => match[1]
  );
  assert.ok(files.length > 0, `${filename} contains no changes`);
  const temporary = mkdtempSync(join(tmpdir(), "one-map-tf08-patch-"));

  try {
    for (const file of files) {
      const target = join(temporary, file);
      mkdirSync(dirname(target), { recursive: true });
      copyFileSync(join(peerRoot, file), target);
    }
    for (const flags of [["--reverse"], ["--check"], []]) {
      const result = spawnSync("git", ["apply", ...flags, patchFile], {
        cwd: temporary,
        encoding: "utf8",
      });
      if (result.error) throw result.error;
      assert.equal(result.status, 0, `${filename}: ${result.stderr}`);
    }
    for (const file of files) {
      assert.deepEqual(
        readFileSync(join(temporary, file)),
        readFileSync(join(peerRoot, file)),
        `Patch output differs: ${filename} ${file}`
      );
    }
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
};

const source = readFileSync(
  resolve(rnRoot, "src/modules/snapshot/SnapshotOptions.ts"),
  "utf8"
);
const compiled = transformSync(source, {
  filename: "SnapshotOptions.ts",
  configFile: resolve(root, "babel.config.cjs"),
}).code;
const exports = {};
runInNewContext(compiled, {
  exports,
  require: (name) => {
    if (name === "react-native")
      return {
        NativeModules: {
          RNMBXModule: { StyleURL: { Street: "fixture://style" } },
        },
      };
    if (name.endsWith("geoUtils"))
      return {
        makePoint: (coordinates) => ({ type: "Point", coordinates }),
        makeFeatureCollection: (features) => ({
          type: "FeatureCollection",
          features,
        }),
      };
    if (name.endsWith("utils")) return { toJSONString: JSON.stringify };
    throw new Error(`Unexpected snapshot dependency: ${name}`);
  },
});
const zero = new exports.default({ centerCoordinate: [0, 0], zoomLevel: 0 });
assert.equal(zero.toJSON().zoomLevel, 0);
assert.equal(
  new exports.default({ centerCoordinate: [0, 0] }).toJSON().zoomLevel,
  16
);

const android = readFileSync(
  resolve(
    mlRoot,
    "android/src/main/java/org/maplibre/reactnative/modules/MLRNStaticMapModule.kt"
  ),
  "utf8"
);
assert.match(
  android,
  /\) \{ error ->[\s\S]*snapshotterMap\.remove\(snapshotterID\)[\s\S]*promise\.reject/
);
assert.match(
  android,
  /if \(result == null\) \{\s*snapshotterMap\.remove\(snapshotterID\)/
);
assert.match(android, /options\.withPixelRatio\(1f\)/);
const ios = readFileSync(
  resolve(mlRoot, "ios/modules/static-map/MLRNStaticMapModule.mm"),
  "utf8"
);
assert.match(ios, /mapSnapshotOptions\.scale = 1\.0/);

for (const [file, start, end] of [
  [
    resolve(rnRoot, "ios/RNMBX/Offline/RNMBXOfflineModule.swift"),
    "func getPackStatus(",
    "func resumePackDownload(",
  ],
  [
    resolve(
      rnRoot,
      "android/src/main/java/com/rnmapbox/rnmbx/modules/RNMBXOfflineModule.kt"
    ),
    "fun getPackStatus(",
    "fun resumePackDownload(",
  ],
]) {
  const status = nativeSection(readFileSync(file, "utf8"), start, end);
  // Reading status may construct a response, but must never replace the native
  // pack that owns a running download's cancellation handles.
  assert.doesNotMatch(
    status,
    /TileRegionPack\(|tileRegionPacks\s*\[[^\]]+\]\s*=/
  );
  assert.match(status, /_makeRegionStatusPayload\(/);
  assert.match(status, /tileRegionPacks\[name\]\?\.state/);
}

const mlOffline = readFileSync(
  resolve(
    mlRoot,
    "android/src/main/java/org/maplibre/reactnative/modules/MLRNOfflineModule.kt"
  ),
  "utf8"
);

// The JavaScript methods must have callable native bindings on both platforms.
for (const [platform, extension, prefix] of [
  ["android/src/main/java/com/rnmapbox/rnmbx/modules", "kt", "fun"],
  ["ios/RNMBX/Offline", "swift", "func"],
]) {
  const offline = readFileSync(
    resolve(rnRoot, `${platform}/RNMBXOfflineModule.${extension}`),
    "utf8"
  );
  const invalidate = nativeSection(
    offline,
    `${prefix} invalidatePack(`,
    `${prefix} resumePackDownload(`
  );
  assert.match(invalidate, /startLoading\([\s\S]*acceptExpired\s*[=:] false/);
  assert.match(
    offline,
    /acceptExpired\(acceptExpired\)|acceptExpired: acceptExpired/
  );
  // Cached counts cannot complete a refresh while its SDK callbacks are active.
  assert.match(
    offline,
    /state == (?:TileRegionPackState.UNKNOWN|\.unknown).*progress.hasCompleted\(\)/
  );
  assert.match(offline, /generation/);
  // Recreating the same pack ID must not reuse a cancelled load's generation.
  assert.match(offline, /nextLoadGeneration/);
}
const iosOfflineBridge = readFileSync(
  resolve(rnRoot, "ios/RNMBX/Offline/RNMBXOfflineModule.m"),
  "utf8"
);
assert.match(iosOfflineBridge, /RCT_EXTERN_METHOD\(invalidatePack:/);
for (const file of [
  "android/src/main/java/com/rnmapbox/rnmbx/modules/RNMBXModule.kt",
  "ios/RNMBX/RNMBXModule.swift",
]) {
  const module = readFileSync(resolve(rnRoot, file), "utf8");
  assert.match(module, /(?:fun|func) setConnected\(/);
  assert.match(module, /OfflineSwitch/);
}
assert.match(
  readFileSync(resolve(rnRoot, "ios/RNMBX/RNMBXModule.m"), "utf8"),
  /RCT_EXTERN_METHOD\(setConnected:/
);
const observer = nativeSection(
  mlOffline,
  "private fun setOfflineRegionObserver(",
  "private fun makeErrorPayload("
);
assert.match(observer, /region\.setObserver\(/);
assert.doesNotMatch(observer, /setDownloadState\(/);
const create = nativeSection(
  mlOffline,
  "override fun createPack(",
  "override fun invalidatePack("
);
assert.match(
  create,
  /setOfflineRegionObserver\(packId, offlineRegion\)[\s\S]*offlineRegion\.setDownloadState\(OfflineRegion\.STATE_ACTIVE\)/
);
const attach = nativeSection(
  mlOffline,
  "override fun setPackObserver(",
  "override fun invalidatePack("
);
assert.match(attach, /setOfflineRegionObserver\(id, region\)/);
assert.doesNotMatch(attach, /setDownloadState\(/);
const resume = nativeSection(
  mlOffline,
  "override fun resumePackDownload(",
  "override fun mergeOfflineRegions("
);
assert.match(resume, /setDownloadState\(OfflineRegion\.STATE_ACTIVE\)/);

verifyPeerPatch(rnRoot, "rnmapbox-10.3.7-tf08.patch");
verifyPeerPatch(mlRoot, "maplibre-native-11.5.0-tf08.patch");
console.log(
  "PASS TF08 peer patches: clean application round trips, RNMapbox zero-zoom constructor execution, and native source assertions for image cleanup/scale and offline download ownership."
);
console.log(
  "SCOPE: mocked JavaScript execution and native source checks only; no native compilation, SDK rendering, or device/service acceptance."
);
