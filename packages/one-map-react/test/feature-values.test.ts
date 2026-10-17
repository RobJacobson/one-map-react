import { describe, expect, test } from "vite-plus/test";

import {
  assertFeatureIdentifier,
  assertFeatureState,
  featureStateFromWrapper,
  featuresFromWrapper,
  isScreenBounds,
  mutableFeatureState,
  toQueryGeometry,
  toRnmapboxRect,
} from "../src/adapters/shared/feature-values.js";

describe("featuresFromWrapper", () => {
  test("returns a feature array unchanged", () => {
    const features = [{ type: "Feature" }, { type: "Feature" }];

    expect(featuresFromWrapper(features, "queryRenderedFeatures")).toBe(
      features
    );
  });

  test("reads the features out of a feature collection", () => {
    const features = [{ type: "Feature", id: 1 }];

    expect(
      featuresFromWrapper(
        { type: "FeatureCollection", features },
        "queryRenderedFeatures"
      )
    ).toBe(features);
  });

  test("parses an Android JSON string payload", () => {
    const payload = JSON.stringify({
      type: "FeatureCollection",
      features: [{ type: "Feature", id: 2 }],
    });

    expect(featuresFromWrapper(payload, "getClusterLeaves")).toEqual([
      { type: "Feature", id: 2 },
    ]);
  });

  test("preserves an empty result as an empty array", () => {
    expect(
      featuresFromWrapper(
        { type: "FeatureCollection", features: [] },
        "querySourceFeatures"
      )
    ).toEqual([]);
  });

  test("rejects an absent native result", () => {
    expect(() =>
      featuresFromWrapper(undefined, "queryRenderedFeatures")
    ).toThrow("queryRenderedFeatures returned no result.");
  });

  test("rejects a collection without a feature array", () => {
    expect(() =>
      featuresFromWrapper(
        { type: "FeatureCollection" },
        "queryRenderedFeatures"
      )
    ).toThrow("without a feature array");
  });

  test("rejects a non-container payload", () => {
    expect(() => featuresFromWrapper(42, "queryRenderedFeatures")).toThrow(
      "not a feature container"
    );
  });

  test("rejects an invalid JSON string payload", () => {
    expect(() =>
      featuresFromWrapper("not-json{", "getClusterChildren")
    ).toThrow("not valid JSON");
  });
});

describe("isScreenBounds", () => {
  test("accepts a two-corner rectangle", () => {
    expect(
      isScreenBounds([
        [10, 20],
        [30, 40],
      ])
    ).toBe(true);
  });

  test("rejects a point", () => {
    expect(isScreenBounds([10, 20])).toBe(false);
  });

  test("rejects an undefined viewport target", () => {
    expect(isScreenBounds(undefined)).toBe(false);
  });
});

test.each([
  { target: undefined, expected: undefined },
  { target: [10, 20], expected: [10, 20] },
  {
    target: [
      [10, 20],
      [30, 40],
    ],
    expected: [
      [10, 20],
      [30, 40],
    ],
  },
] as const)(
  "query geometry preserves $target without sharing coordinates",
  ({ target, expected }) => {
    const geometry = toQueryGeometry(target);
    expect(geometry).toEqual(expected);

    if (Array.isArray(geometry)) {
      const coordinates = Array.isArray(geometry[0]) ? geometry : [geometry];
      for (const coordinate of coordinates) coordinate[0] = 99;
    }
    expect(target).toEqual(expected);
  }
);

describe("toRnmapboxRect", () => {
  test("reorders corners into top, left, bottom, right", () => {
    expect(
      toRnmapboxRect([
        [10, 20],
        [30, 40],
      ])
    ).toEqual([20, 10, 40, 30]);
  });
});

describe("assertFeatureIdentifier", () => {
  test("accepts a string id", () => {
    const identifier = { source: "routes", id: "route-1" };

    expect(assertFeatureIdentifier(identifier)).toBe(identifier);
  });

  test("accepts a numeric id with a source layer", () => {
    const identifier = { source: "tiles", id: 7, sourceLayer: "buildings" };

    expect(assertFeatureIdentifier(identifier)).toBe(identifier);
  });

  test("rejects an empty source", () => {
    expect(() => assertFeatureIdentifier({ source: "", id: 1 })).toThrow(
      "nonempty string"
    );
  });

  test("rejects a missing feature id", () => {
    expect(() =>
      assertFeatureIdentifier({
        source: "routes",
        id: undefined as unknown as string,
      })
    ).toThrow("string or number id");
  });
});

describe("assertFeatureState", () => {
  test("accepts JSON values including nested objects and arrays", () => {
    expect(() =>
      assertFeatureState({
        selected: true,
        count: 2,
        name: "route",
        tags: ["a", "b"],
        empty: [],
        meta: { depth: { level: 1 } },
      })
    ).not.toThrow();
  });

  test("rejects a null value", () => {
    expect(() =>
      assertFeatureState({ selected: null as unknown as boolean })
    ).toThrow('Feature state key "selected"');
  });

  test("rejects an undefined value", () => {
    expect(() =>
      assertFeatureState({ selected: undefined as unknown as boolean })
    ).toThrow("Feature state key");
  });

  test("rejects a non-finite number", () => {
    expect(() => assertFeatureState({ score: Number.NaN })).toThrow(
      "non-finite"
    );
    expect(() =>
      assertFeatureState({ score: Number.POSITIVE_INFINITY })
    ).toThrow("non-finite");
  });

  test("rejects a null nested in an object", () => {
    expect(() =>
      assertFeatureState({ meta: { depth: null as unknown as number } })
    ).toThrow("non-finite");
  });

  test("rejects a null array element", () => {
    expect(() =>
      assertFeatureState({ tags: [1, null as unknown as number] })
    ).toThrow("non-finite");
  });

  test("rejects an array consisting only of empty slots", () => {
    // eslint-disable-next-line unicorn/no-new-array -- A sparse array is intentional invalid input; filling its hole would weaken this validation test.
    expect(() => assertFeatureState({ values: new Array<number>(1) })).toThrow(
      'Feature state key "values"'
    );
  });

  test.each([0, 1, 2])("rejects an array with a hole at index %i", (index) => {
    const values = [1, 2, 3];
    delete values[index];

    expect(() => assertFeatureState({ values })).toThrow(
      'Feature state key "values"'
    );
    expect(values).toHaveLength(3);
    expect(Object.hasOwn(values, index)).toBe(false);
  });

  test("rejects sparse arrays nested inside objects", () => {
    expect(() =>
      // eslint-disable-next-line unicorn/no-new-array -- A sparse array is intentional invalid input; filling its hole would weaken this validation test.
      assertFeatureState({ meta: { values: new Array<number>(1) } })
    ).toThrow('Feature state key "meta"');
  });

  test("rejects sparse arrays nested inside arrays", () => {
    expect(() =>
      // eslint-disable-next-line unicorn/no-new-array -- A sparse array is intentional invalid input; filling its hole would weaken this validation test.
      assertFeatureState({ values: [[1], new Array<number>(1)] })
    ).toThrow('Feature state key "values"');
  });
});

describe("featureStateFromWrapper", () => {
  test("returns a present state object unchanged", () => {
    const state = { selected: true };

    expect(featureStateFromWrapper(state)).toBe(state);
  });

  test("resolves absent state to an empty object", () => {
    expect(featureStateFromWrapper(null)).toEqual({});
    expect(featureStateFromWrapper(undefined)).toEqual({});
  });

  test("rejects a non-object state", () => {
    expect(() => featureStateFromWrapper("selected")).toThrow(
      "must be an object"
    );
  });
});

test.each([
  ["null", "returned no result"],
  ["{}", "not a feature container"],
  ['{"type":"FeatureCollection","features":null}', "without a feature array"],
])("valid JSON %s retains its normalization error", (payload, message) => {
  expect(() => featuresFromWrapper(payload, "querySourceFeatures")).toThrow(
    message
  );
});

test("JSON syntax failures retain their cause", () => {
  try {
    featuresFromWrapper("{", "querySourceFeatures");
    throw new Error("expected parse failure");
  } catch (error) {
    expect(error).toEqual(
      expect.objectContaining({ cause: expect.any(SyntaxError) })
    );
  }
});

test("feature-state dispatch copies validated nested values before a queued caller can mutate them", () => {
  const state = { nested: { selected: true }, values: [1, { count: 2 }] };
  assertFeatureState(state);
  const copied = mutableFeatureState(state);
  state.nested.selected = false;
  state.values.push(3);
  (state.values[1] as { count: number }).count = 9;
  expect(copied).toEqual({
    nested: { selected: true },
    values: [1, { count: 2 }],
  });
});
