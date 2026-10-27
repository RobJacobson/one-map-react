import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";

import type { FeatureState } from "../src/contracts/query-types.js";

const require = createRequire(import.meta.url);

interface SourceState {
  updateState: (
    layer: string,
    id: number | string,
    state: FeatureState
  ) => void;
  removeFeatureState: (
    layer: string,
    id: number | string,
    key?: string
  ) => void;
  getState: (layer: string, id: number | string) => FeatureState;
  initializeTileState: (tile: object, style: object) => void;
  coalesceChanges: (tiles: object, style: object) => void;
}

/**
 * Runs the installed SDK state queue without constructing a map or renderer.
 *
 * @param backend - Pinned web SDK whose source-state implementation to load.
 * @returns Feature-state calls and the SDK's frame coalescence operation.
 */
export const sdkFeatureState = (backend: "mapbox" | "maplibre") => {
  const mapbox = backend === "mapbox";
  const sourceMap = mapbox
    ? (JSON.parse(
        readFileSync(require.resolve("mapbox-gl/dist/mapbox-gl.js.map"), "utf8")
      ) as { sources: string[]; sourcesContent: string[] })
    : undefined;
  const source = sourceMap
    ? sourceMap.sourcesContent[
        sourceMap.sources.findIndex((name) =>
          name.endsWith("/source/source_state.ts")
        )
      ]
    : readFileSync(
        resolve(
          dirname(require.resolve("maplibre-gl/package.json")),
          "src/source/source_state.ts"
        ),
        "utf8"
      );
  if (
    typeof source !== "string" ||
    !source.includes("class SourceFeatureState")
  ) {
    throw new Error("Installed SDK source-state implementation is missing.");
  }
  const { transformSync } = require("@babel/core");
  const compiled = transformSync(source, {
    filename: "source_state.ts",
    configFile: false,
    babelrc: false,
    presets: ["module:@react-native/babel-preset"],
  });
  if (!compiled?.code) throw new Error("SDK state compilation failed.");
  const exports: {
    default?: new () => SourceState;
    SourceFeatureState?: new () => SourceState;
  } = {};
  // Keep SDK errors in this realm so the smoke's normal Error handling sees them.
  new Function("exports", "require", compiled.code)(exports, (name: string) =>
    name.includes("util/util") ? { extend: Object.assign } : require(name)
  );
  const State = exports.default ?? exports.SourceFeatureState;
  if (!State) throw new Error("SDK SourceFeatureState is missing.");
  const state = new State();
  state.initializeTileState(
    { refreshFeatureState: () => {}, setFeatureState: () => {} },
    {}
  );
  const layer = "_geojsonTileLayer";
  return {
    setFeatureState: (id: number | string, value: FeatureState) =>
      state.updateState(layer, id, value),
    getFeatureState: (id: number | string) => state.getState(layer, id),
    removeFeatureState: (id: number | string, key?: string) =>
      state.removeFeatureState(layer, id, key),
    coalesce: () =>
      state.coalesceChanges(mapbox ? {} : { setFeatureState: () => {} }, {}),
  };
};
