import { expect, test } from "vite-plus/test";

import {
  assertMaplibreExpressions,
  assertMaplibreLayerStyle,
  assertMaplibreStyleRoots,
  maplibreStyleForNative,
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
  ["paint", "resampling", "nearest"],
  ["paint", "line-layer-opacity", 0],
  ["paint", "fill-layer-opacity", 0],
  ["layout", "icon-overlap", "cooperative"],
  ["layout", "text-overlap", "always"],
  ["style", "resampling", "nearest"],
  ["style", "lineLayerOpacity", 0],
  ["style", "fillLayerOpacity", 0],
  ["style", "iconOverlap", "cooperative"],
  ["style", "textOverlap", "always"],
])("rejects unsupported native layer property %s.%s", (section, key, value) => {
  const layer = { [section]: { [key]: value } };
  const message = `Layer property "${key}" is unsupported`;

  expect(() => assertMaplibreLayerStyle(layer)).toThrow(message);
  expect(() => assertMaplibreStyleRoots({ layers: [layer] })).toThrow(message);
});

test("the style document guard leaves text-variable-anchor-offset to the SDK", () => {
  const style = {
    version: 8,
    sources: {},
    layers: [
      {
        id: "labels",
        type: "symbol",
        layout: { "text-variable-anchor-offset": ["top", [0, 1]] },
      },
    ],
  };
  expect(() => assertMaplibreStyleRoots(style)).not.toThrow();
  expect(() => assertMaplibreStyleRoots(JSON.stringify(style))).not.toThrow();
});

test("legacy native raster sampling and basic symbol overlap remain available", () => {
  expect(() =>
    assertMaplibreLayerStyle({
      style: { rasterResampling: "nearest" },
    })
  ).not.toThrow();
  expect(() =>
    assertMaplibreLayerStyle({
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

test("treats undefined style roots as omitted while keeping null and invalid projections rejected", () => {
  expect(() =>
    assertMaplibreStyleRoots({
      version: 8,
      sources: {},
      layers: [],
      terrain: undefined,
      sky: undefined,
      state: undefined,
      projection: undefined,
    })
  ).not.toThrow();

  for (const key of ["terrain", "sky", "state"]) {
    expect(() => assertMaplibreStyleRoots({ [key]: null })).toThrow(
      `Style root "${key}" is unsupported`
    );
  }
  for (const projection of [null, {}, { type: undefined }]) {
    expect(() => assertMaplibreStyleRoots({ projection })).toThrow(
      "only Mercator"
    );
  }
});

test.each([
  ["geojson", "generateId"],
  ["geojson", "promoteId"],
  ["geojson", "filter"],
  ["geojson", "attribution"],
  ["geojson", "volatile"],
  ["vector", "promoteId"],
  ["vector", "volatile"],
  ["raster", "volatile"],
  ["raster-dem", "redFactor"],
  ["raster-dem", "greenFactor"],
  ["raster-dem", "blueFactor"],
  ["raster-dem", "baseShift"],
  ["raster-dem", "volatile"],
])(
  "treats undefined %s.%s source option as omitted while rejecting false and null",
  (type, key) => {
    expect(() =>
      assertMaplibreStyleRoots({
        sources: { fixture: { type, [key]: undefined } },
      })
    ).not.toThrow();
    for (const value of [false, null]) {
      expect(() =>
        assertMaplibreStyleRoots({
          sources: { fixture: { type, [key]: value } },
        })
      ).toThrow(`Source option "${key}" is unsupported`);
    }
  }
);

test("treats undefined expression modifiers and layer properties as omitted while rejecting defined values", () => {
  expect(() =>
    assertMaplibreExpressions(["number-format", 1, { unit: undefined }])
  ).not.toThrow();
  expect(() =>
    assertMaplibreExpressions([
      "format",
      "text",
      { "vertical-align": undefined },
    ])
  ).not.toThrow();
  expect(() =>
    assertMaplibreExpressions(["number-format", 1, { unit: null }])
  ).toThrow("number-format.unit");
  expect(() =>
    assertMaplibreExpressions(["format", "text", { "vertical-align": null }])
  ).toThrow("format.vertical-align");

  expect(() =>
    assertMaplibreLayerStyle({
      paint: {
        resampling: undefined,
        "fill-layer-opacity": undefined,
        "line-layer-opacity": undefined,
      },
      layout: {
        "icon-overlap": undefined,
        "text-overlap": undefined,
      },
      style: {
        resampling: undefined,
        fillLayerOpacity: undefined,
        lineLayerOpacity: undefined,
        iconOverlap: undefined,
        textOverlap: undefined,
      },
    })
  ).not.toThrow();
});

test("object styles validate the serialized document the wrapper forwards", () => {
  const reads: unknown[] = [undefined, {}];
  const style = {
    version: 8,
    sources: {},
    layers: [],
    get sky() {
      return reads.shift();
    },
  };
  const forwarded = maplibreStyleForNative(style);
  const wrapperDocument =
    typeof forwarded === "object" ? JSON.stringify(forwarded) : forwarded;

  expect(wrapperDocument).toBe(forwarded);
  expect(JSON.parse(String(forwarded))).toEqual({
    version: 8,
    sources: {},
    layers: [],
  });
  expect(style.sky).toEqual({});
  expect(() =>
    maplibreStyleForNative({
      version: 8,
      sources: {},
      layers: [],
      get sky() {
        return {};
      },
    })
  ).toThrow('Style root "sky"');
  expect(() => maplibreStyleForNative({ sky: {} })).toThrow('Style root "sky"');

  const url = "https://example.test/style.json";
  const json = JSON.stringify({ version: 8, sources: {}, layers: [] });
  expect(maplibreStyleForNative(url)).toBe(url);
  expect(maplibreStyleForNative(json)).toBe(json);
  expect(maplibreStyleForNative(undefined)).toBeUndefined();
  expect(() =>
    maplibreStyleForNative({
      layers: [
        {
          type: "symbol",
          layout: { "text-field": ["number-format", 1, { unit: "meter" }] },
        },
      ],
    })
  ).toThrow("number-format.unit");
  expect(
    JSON.parse(
      String(
        maplibreStyleForNative({
          layers: [
            {
              type: "symbol",
              layout: {
                "text-field": [
                  "format",
                  "text",
                  { "vertical-align": undefined },
                ],
              },
            },
          ],
        })
      )
    ).layers[0].layout["text-field"]
  ).toEqual(["format", "text", {}]);
});
