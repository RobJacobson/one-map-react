import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";

import { transformSync } from "@babel/core";

const root = resolve(import.meta.dirname, "..");
const requireRuntime = createRequire(import.meta.url);

const loadManager = (peer, file, requirePeer) => {
  const exports = {};
  const code = transformSync(
    readFileSync(resolve(root, "node_modules", peer, file), "utf8"),
    {
      filename: file,
      configFile: resolve(root, "babel.config.cjs"),
    }
  ).code;
  runInNewContext(code, {
    exports,
    require: (name) =>
      name.startsWith("@babel/runtime/")
        ? requireRuntime(name)
        : requirePeer(name),
  });
  return exports;
};

for (const file of [
  "src/modules/offline/OfflineManager.ts",
  "lib/module/modules/offline/OfflineManager.js",
  "lib/commonjs/modules/offline/OfflineManager.js",
]) {
  let packs = [{ id: "existing", metadata: "{}", bounds: [0, 0, 1, 1] }];
  let resetFails = true;
  let released = 0;
  const native = {
    getPacks: async () => packs,
    resetDatabase: async () => {
      if (resetFails) throw new Error("Storage error");
      packs = [];
    },
    setPackObserver: async () => true,
    onProgress: () => ({ remove: () => (released += 1) }),
    onError: () => ({ remove: () => (released += 1) }),
    mergeOfflineRegions: async () =>
      packs.push({ id: "imported", metadata: "{}", bounds: [0, 0, 1, 1] }),
  };
  const { OfflineManager: manager } = loadManager(
    "@maplibre/maplibre-react-native",
    file,
    (name) => {
      if (name.includes("NativeOfflineModule"))
        return { __esModule: true, default: native };
      if (name.includes("OfflinePack"))
        return {
          OfflinePack: class {
            constructor(pack) {
              Object.assign(this, pack);
            }
          },
        };
      throw new Error(`Unexpected dependency: ${name}`);
    }
  );
  assert.equal((await manager.getPacks()).length, 1);
  await manager.addListener(
    "existing",
    () => {},
    () => {}
  );
  await assert.rejects(manager.resetDatabase(), /Storage error/);
  assert.equal((await manager.getPacks()).length, 1);
  assert.equal(released, 0, "Failed resets must retain existing observations.");
  resetFails = false;
  await manager.resetDatabase();
  assert.equal((await manager.getPacks()).length, 0);
  assert.equal(released, 2);
  await assert.rejects(manager.getPack("existing"), /not found/);
  await manager.mergeOfflineRegions("fixture.db");
  assert.equal((await manager.getPacks())[0].id, "imported");
}

for (const file of [
  "src/modules/offline/offlineManager.ts",
  "lib/module/modules/offline/offlineManager.js",
]) {
  let clears = 0;
  let clearFails = false;
  const native = {
    clearAmbientCache: async () => {
      if (clearFails) throw new Error("Cache storage error");
      clears += 1;
    },
  };
  const { default: manager } = loadManager("@rnmapbox/maps", file, (name) => {
    if (name === "react-native")
      return {
        NativeModules: { RNMBXModule: {}, RNMBXOfflineModule: native },
        NativeEventEmitter: class {},
      };
    if (name.includes("utils")) return {};
    if (
      name.includes("OfflinePack") ||
      name.includes("OfflineCreatePackOptions")
    )
      return { __esModule: true, default: class {} };
    throw new Error(`Unexpected dependency: ${name}`);
  });
  await manager.clearAmbientCache();
  assert.equal(clears, 1);
  clearFails = true;
  await assert.rejects(manager.clearAmbientCache(), /Cache storage error/);
  await assert.rejects(
    manager.invalidateAmbientCache(),
    /no in-place ambient cache invalidation API/
  );
  await assert.rejects(
    manager.setMaximumAmbientCacheSize(1000),
    /no legacy ambient cache size API/
  );
}

for (const file of [
  "src/modules/offline/offlineManagerLegacy.ts",
  "lib/module/modules/offline/offlineManagerLegacy.js",
]) {
  let packs = [{ metadata: JSON.stringify({ name: "existing" }) }];
  let reads = 0;
  const { default: manager } = loadManager("@rnmapbox/maps", file, (name) => {
    if (name === "react-native")
      return {
        NativeModules: {
          RNMBXOfflineModuleLegacy: {
            getPacks: async () => {
              reads += 1;
              return packs;
            },
          },
        },
      };
    if (name.includes("OfflinePackLegacy"))
      return {
        __esModule: true,
        default: class {
          constructor(pack) {
            this.name = JSON.parse(pack.metadata).name;
          }
        },
      };
    if (name.includes("OfflineCreatePackOptions")) return {};
    throw new Error(`Unexpected dependency: ${name}`);
  });
  assert.equal((await manager.getPacks()).length, 1);
  packs = [...packs, { metadata: JSON.stringify({ name: "imported" }) }];
  assert.equal((await manager.getPacks()).length, 2);
  assert.equal(
    reads,
    2,
    "Public legacy enumeration must refresh packs imported by the selected manager."
  );
}

console.log(
  "TF08 offline peer regressions passed for source and published JavaScript."
);
