import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { runInNewContext } from "node:vm";

const require = createRequire(import.meta.url);

type SdkRenderedQuery = (
  point: unknown,
  options?: { readonly layers?: readonly string[] }
) => unknown[];

/**
 * Executes the installed SDK's ordering method without constructing a renderer.
 *
 * @param backend - Installed SDK whose ordering method to exercise.
 * @returns A query over overlapping 2D and 3D fixture hits.
 */
export const sdkOrderedQuery = (
  backend: "mapbox-web" | "maplibre-web"
): SdkRenderedQuery => {
  const mapbox = backend === "mapbox-web";
  const sourceMap = mapbox
    ? (JSON.parse(
        readFileSync(require.resolve("mapbox-gl/dist/mapbox-gl.js.map"), "utf8")
      ) as { sources: string[]; sourcesContent: string[] })
    : undefined;
  const source = sourceMap
    ? sourceMap.sourcesContent[
        sourceMap.sources.findIndex((name) => name.endsWith("/style/style.ts"))
      ]
    : readFileSync(
        resolve(
          dirname(require.resolve("maplibre-gl/package.json")),
          "src/style/style.ts"
        ),
        "utf8"
      );
  const start = source.indexOf("    _flattenAndSortRenderedFeatures(");
  const end = source.indexOf(
    mapbox ? "\n    queryRasterValue(" : "\n    queryRenderedFeatures(",
    start
  );
  if (start < 0 || end < 0) throw new Error("SDK ordering method is missing.");
  const { transformSync } = require("@babel/core");
  const compiled = transformSync(`({${source.slice(start, end)}})`, {
    filename: "sdk-query.ts",
    configFile: false,
    babelrc: false,
    presets: ["module:@react-native/babel-preset"],
  });
  const style = runInNewContext(compiled.code, { require });
  const order = ["near-building", "route-line", "places-line"];
  style.order = style._order = order;
  style._layers = style._mergedLayers = Object.fromEntries(
    order.map((id) => [
      id,
      {
        type: id === "route-line" ? "line" : "fill-extrusion",
        is3D: () => id !== "route-line",
      },
    ])
  );
  const entries = order.map((id, index) => ({
    intersectionZ: [1, 0, 10][index],
    feature: {
      type: "Feature",
      id,
      source: id === "route-line" ? "routes" : "places",
      layer: { id },
      properties: {},
    },
  }));
  return (_point: unknown, options?: { readonly layers?: readonly string[] }) =>
    style._flattenAndSortRenderedFeatures([
      Object.fromEntries(
        entries
          .filter(
            ({ feature }) => options?.layers?.includes(feature.id) ?? true
          )
          .map((entry) => [entry.feature.id, [entry]])
      ),
    ]);
};

/**
 * Uses Mapbox's shipped public query dispatch, including root featureset results.
 *
 * @returns A query with a plain feature and its root featureset variant.
 */
export const sdkFeaturesetQuery = (): SdkRenderedQuery => {
  const { Map: MapboxMap } = require("mapbox-gl");
  const feature = {
    type: "Feature",
    id: "plain",
    source: "places",
    layer: { id: "places-line" },
    properties: {},
  };
  const map = {
    style: {
      queryRenderedFeatures: () => [feature],
      queryRenderedFeatureset: () => [
        { ...feature, id: "variant", target: { featuresetId: "places" } },
      ],
    },
    transform: { width: 100, height: 100 },
    _isValidId: () => true,
  };
  return (point: unknown, options?: { readonly layers?: readonly string[] }) =>
    MapboxMap.prototype.queryRenderedFeatures.call(map, point, options);
};
