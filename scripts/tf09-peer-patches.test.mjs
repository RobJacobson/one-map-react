import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const root = new URL("../node_modules/@rnmapbox/maps/", import.meta.url);
const module = readFileSync(
  new URL("lib/module/components/MapView.js", root),
  "utf8"
);
const method = module.match(
  /async queryTerrainElevation\(coordinate\) \{[\s\S]*?\n  \}/
)?.[0];
assert(method, "Installed public queryTerrainElevation method is missing.");
const query = runInNewContext(`({ ${method} }).queryTerrainElevation`);
for (const [response, expected] of [
  [null, null],
  [undefined, null],
  [{ data: null }, null],
  [{ data: 0 }, 0],
  [{ data: -5 }, -5],
]) {
  const coordinate = Object.freeze([0, 0]);
  const receiver = {
    _runNative: async (name, args) => {
      assert.equal(name, "queryTerrainElevation");
      assert.equal(args[0], coordinate);
      return response;
    },
  };
  assert.equal(await query.call(receiver, coordinate), expected);
}
const failure = new Error("operational bridge failure");
await assert.rejects(
  query.call(
    {
      _runNative: async () => {
        throw failure;
      },
    },
    [0, 0]
  ),
  (error) => error === failure
);
const android = readFileSync(
  new URL(
    "android/src/main/java/com/rnmapbox/rnmbx/components/mapview/RNMBXMapView.kt",
    root
  ),
  "utf8"
);
const section = android.slice(
  android.indexOf("fun queryTerrainElevation"),
  android.indexOf("fun clearData", android.indexOf("fun queryTerrainElevation"))
);
assert(section.includes('putNull("data")'));
assert(!section.includes('response.error("no elevation data")'));
for (const [path, token] of [
  ["ios/RNMBX/RNMBXTerrain.swift", "guard sourceID != nil"],
  [
    "android/src/main/java/com/rnmapbox/rnmbx/components/styles/terrain/RNMBXTerrain.kt",
    "if (mSourceID == null)",
  ],
  [
    "android/src/main/java/com/rnmapbox/rnmbx/components/styles/terrain/RNMBXTerrainManager.kt",
    "sourceID.isNull",
  ],
])
  assert(readFileSync(new URL(path, root), "utf8").includes(token));
console.log(
  "PASS terrain peer boundary: executed shipped public query with null/zero/failure; native no-data/disable transport assertions. Native compilation/rendering remain acceptance work."
);
