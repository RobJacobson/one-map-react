import { expect, test } from "vite-plus/test";

import {
  assertMaplibreExpressions,
  assertMaplibreLayerStyle,
  assertMaplibreStyleRoots,
} from "../src/adapters/maplibre-native/style-roots.js";

test("supported style documents and metadata pass unchanged; URLs remain wrapper-owned", () => {
  const style = Object.freeze({
    version: 8,
    sources: {},
    layers: [],
    metadata: { terrain: true },
    projection: { type: "mercator" },
  });
  expect(() => assertMaplibreStyleRoots(style)).not.toThrow();
  expect(() => assertMaplibreStyleRoots(JSON.stringify(style))).not.toThrow();
  expect(() =>
    assertMaplibreStyleRoots("https://example.test/style.json")
  ).not.toThrow();
  expect(() => assertMaplibreStyleRoots(undefined)).not.toThrow();
});

test.each(["terrain", "sky", "state"])(
  "explicit unsupported %s root fails before a silent native no-op",
  (key) => {
    const style = { version: 8, sources: {}, layers: [], [key]: null };
    expect(() => assertMaplibreStyleRoots(style)).toThrow(
      `Style root "${key}" is unsupported`
    );
    expect(() => assertMaplibreStyleRoots(JSON.stringify(style))).toThrow(
      `Style root "${key}" is unsupported`
    );
  }
);

test("globe and unsupported projection expressions fail; malformed JSON retains a useful error", () => {
  for (const projection of [
    { type: "globe" },
    { type: ["literal", "mercator"] },
    null,
  ]) {
    expect(() => assertMaplibreStyleRoots({ projection })).toThrow(
      "only Mercator"
    );
  }
  expect(() => assertMaplibreStyleRoots("{invalid}")).toThrow(SyntaxError);
});

test.each([
  ["geojson", "generateId"],
  ["geojson", "promoteId"],
  ["geojson", "filter"],
  ["geojson", "attribution"],
  ["vector", "promoteId"],
  ["raster", "volatile"],
  ["raster-dem", "redFactor"],
])(
  "explicit %s.%s style source options cannot silently disappear in the native parser",
  (type, key) => {
    expect(() =>
      assertMaplibreStyleRoots({ sources: { fixture: { type, [key]: false } } })
    ).toThrow(`Source option "${key}" is unsupported`);
  }
);

test("unsupported video sources fail while ordinary native source fields remain wrapper-owned", () => {
  expect(() =>
    assertMaplibreStyleRoots({ sources: { media: { type: "video" } } })
  ).toThrow("Video sources are unsupported");
  expect(() =>
    assertMaplibreStyleRoots({
      sources: {
        dem: { type: "raster-dem", encoding: "terrarium", scheme: "tms" },
        geojson: {
          type: "geojson",
          cluster: true,
          clusterProperties: { sum: ["+", ["get", "value"]] },
        },
      },
    })
  ).not.toThrow();
});

test.each(["global-state", "interpolate-hcl", "interpolate-lab"])(
  "unsupported %s operator retains native parser ownership while quoted data remains literal",
  (operator) => {
    expect(() => assertMaplibreExpressions([operator, "value"])).not.toThrow();
    expect(() =>
      assertMaplibreExpressions(["literal", [operator, "value"]])
    ).not.toThrow();
    expect(() =>
      assertMaplibreExpressions([
        "match",
        ["get", "kind"],
        [operator, "label"],
        1,
        0,
      ])
    ).not.toThrow();
    expect(() =>
      assertMaplibreStyleRoots({
        layers: [{ paint: { "fill-color": [operator, "value"] } }],
      })
    ).not.toThrow();
  }
);

test("silent native formatting modifiers reject without dropping supported options", () => {
  expect(() =>
    assertMaplibreExpressions(["number-format", 1, { unit: "meter" }])
  ).toThrow("number-format.unit");
  expect(() =>
    assertMaplibreExpressions(["format", "text", { "vertical-align": "top" }])
  ).toThrow("format.vertical-align");
  expect(() =>
    assertMaplibreExpressions([
      "number-format",
      1,
      { currency: "USD", locale: "en" },
    ])
  ).not.toThrow();
  expect(() =>
    assertMaplibreExpressions(["format", "text", { "font-scale": 1 }])
  ).not.toThrow();
});

test.each([
  { type: "raster", paint: { resampling: "nearest" } },
  { type: "line", paint: { "line-layer-opacity": 0 } },
  { type: "fill", paint: { "fill-layer-opacity": 0 } },
  { type: "symbol", layout: { "icon-overlap": "cooperative" } },
  { type: "symbol", layout: { "text-overlap": "always" } },
])(
  "unsupported native layer properties fail with a usable legacy route where equivalent",
  (layer) => {
    expect(() => assertMaplibreLayerStyle(layer)).toThrow("Layer property");
    expect(() => assertMaplibreStyleRoots({ layers: [layer] })).toThrow(
      "Layer property"
    );
  }
);

test("legacy native raster sampling and basic symbol overlap remain available", () => {
  expect(() =>
    assertMaplibreLayerStyle({
      type: "raster",
      style: { rasterResampling: "nearest" },
    })
  ).not.toThrow();
  expect(() =>
    assertMaplibreLayerStyle({
      type: "symbol",
      style: { iconAllowOverlap: true, textAllowOverlap: false },
    })
  ).not.toThrow();
});

test("operator-looking strings in GeoJSON properties remain literal data", () => {
  expect(() =>
    assertMaplibreStyleRoots({
      sources: {
        points: {
          type: "geojson",
          data: {
            type: "Feature",
            geometry: null,
            properties: { label: ["format", "x", { "vertical-align": "top" }] },
          },
        },
      },
    })
  ).not.toThrow();
});
