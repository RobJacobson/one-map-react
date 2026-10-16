import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { runInNewContext } from "node:vm";

import { transformSync } from "@babel/core";

const requireHelper = createRequire(import.meta.url);
const source = readFileSync(
  new URL("../apps/expo/app.config.ts", import.meta.url),
  "utf8"
);
const compiled = transformSync(source, {
  filename: "app.config.ts",
  configFile: path.resolve("babel.config.cjs"),
}).code;

/** Exercises configuration without loading environment files or generating native projects. */
const configure = (values) => {
  const env = { ...values };
  const exports = {};
  runInNewContext(compiled, {
    exports,
    __dirname: path.resolve("apps/expo"),
    process: {
      env,
      loadEnvFile: () => {
        throw new Error("Unexpected environment read.");
      },
    },
    require: (name) => {
      if (name === "node:fs") return { existsSync: () => false };
      if (name === "node:path") return path;
      if (name.startsWith("@babel/runtime/helpers/"))
        return requireHelper(name);
      throw new Error(`Unexpected configuration dependency: ${name}`);
    },
  });
  return { env, config: exports.default };
};

assert.equal(configure({}).env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN, undefined);
assert.equal(
  configure({ MAPBOX_ACCESS_TOKEN: "pk.legacy" }).env
    .EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN,
  "pk.legacy"
);
assert.equal(
  configure({
    MAPBOX_ACCESS_TOKEN: "pk.legacy",
    EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN: "",
  }).env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN,
  ""
);
assert.throws(() => configure({ MAPBOX_ACCESS_TOKEN: "sk.private-value" }), {
  message: "Configure a public Mapbox token beginning with pk.",
});
const { config } = configure({});
assert.deepEqual(
  Array.from(config.plugins, (plugin) => plugin[0]),
  ["expo-build-properties", "@rnmapbox/maps", "@maplibre/maplibre-react-native"]
);
assert.equal(config.plugins[0][1].ios.enableSceneSupport, true);
assert.equal(config.plugins[1][1].RNMapboxMapsVersion, "11.23.1");
assert.equal(config.plugins[2][1].ios.nativeVersion, "6.31.0");
assert.equal(config.plugins[2][1].android.nativeVersion, "13.6.1");
console.log(
  "PASS example Expo configuration: token-free startup, legacy token, explicit disable, secret-token rejection, both plugins and native SDK pins; no native generation or execution."
);
