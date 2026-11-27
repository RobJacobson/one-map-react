import { describe, expect, test } from "vite-plus/test";

import { toRnmapboxQueryRect } from "../src/adapters/mapbox-native/convert-query.js";
import {
  assertFeatureIdentifier,
  copyValidatedFeatureState,
  featureStateFromWrapper,
  featuresFromWrapper,
} from "../src/adapters/shared/feature-values.js";
import {
  isScreenBounds,
  nativeRenderedQuery,
} from "../src/adapters/shared/native-values.js";
import type {
  FeatureIdentifier,
  FeatureState,
} from "../src/contracts/query-types.js";

describe("featuresFromWrapper", () => {
  test("returns a feature array unchanged", () => {
    const features = [{ type: "Feature" }, { type: "Feature" }];

    expect(featuresFromWrapper(features, "queryRenderedFeatures")).toBe(
      features
    );
  });

  test("reads the features out of a feature collection", () => {
    const first = { type: "Feature", id: 2 };
    const second = { type: "Feature", id: 1 };
    const features = [first, second, first];

    const result = featuresFromWrapper(
      { type: "FeatureCollection", features },
      "queryRenderedFeatures"
    );

    expect(result).toBe(features);
    expect(result).toEqual([first, second, first]);
  });

  test("rejects an encoded collection as an invalid container", () => {
    const payload = JSON.stringify({
      type: "FeatureCollection",
      features: [{ type: "Feature", id: 2 }],
    });

    expect(() => featuresFromWrapper(payload, "getClusterLeaves")).toThrow(
      "getClusterLeaves returned a result that is not a feature container."
    );
  });

  test("preserves an empty result as an empty array", () => {
    expect(
      featuresFromWrapper(
        { type: "FeatureCollection", features: [] },
        "querySourceFeatures"
      )
    ).toEqual([]);
  });

  test.each([undefined, null])(
    "rejects an absent native result (%s)",
    (value) => {
      expect(() => featuresFromWrapper(value, "queryRenderedFeatures")).toThrow(
        "queryRenderedFeatures returned no result."
      );
    }
  );

  test.each([
    { type: "FeatureCollection" },
    { type: "FeatureCollection", features: null },
  ])("rejects a collection without a feature array (%j)", (value) => {
    expect(() => featuresFromWrapper(value, "queryRenderedFeatures")).toThrow(
      "without a feature array"
    );
  });

  test("rejects a non-container payload", () => {
    expect(() => featuresFromWrapper(42, "queryRenderedFeatures")).toThrow(
      "not a feature container"
    );
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
  "native rendered query preserves $target without sharing coordinates",
  ({ target, expected }) => {
    const [geometry] = nativeRenderedQuery(target);
    expect(geometry).toEqual(expected);

    if (isScreenBounds(geometry)) {
      geometry[0][0] = 99;
      geometry[1][0] = 99;
      geometry[0] = [99, 99];
    } else if (geometry !== undefined) {
      geometry[0] = 99;
    }
    expect(target).toEqual(expected);
  }
);

test.each([
  { target: [] },
  { target: [[10, 20]] },
  {
    target: [
      [10, 20],
      [30, 40],
      [50, 60],
    ],
  },
])("native rendered query rejects a rectangle with $target", ({ target }) => {
  expect(() =>
    nativeRenderedQuery(
      target as unknown as Parameters<typeof nativeRenderedQuery>[0]
    )
  ).toThrow("A rendered query rectangle must contain exactly two corners.");
});

test.each([null, 42, "viewport", true, 1n, Symbol("viewport"), () => {}])(
  "native rendered query rejects a non-object target (%s)",
  (target) => {
    expect(() =>
      nativeRenderedQuery(
        target as unknown as Parameters<typeof nativeRenderedQuery>[0]
      )
    ).toThrow(
      "A rendered query target must be a point, rectangle, or options object."
    );
  }
);

test.each([{ x: 10 }, { y: 20 }])(
  "native rendered query rejects an incomplete point (%j)",
  (target) => {
    expect(() =>
      // @ts-expect-error Exercise a raw JavaScript point.
      nativeRenderedQuery(target, { layers: ["roads"] })
    ).toThrow("A map point must contain x and y.");
  }
);

test("native rendered query preserves a rectangle with a named y property", () => {
  const corners = [
    [0, 20],
    [30, 40],
  ] as const;
  const rectangle = Object.assign([...corners] as const, { y: 20 });
  const options = { layers: ["roads"] };

  expect(nativeRenderedQuery(rectangle, options)).toEqual([corners, options]);
});

test("RNMapbox rendered queries reorder corners into top, left, bottom, right", () => {
  expect(
    toRnmapboxQueryRect([
      [10, 20],
      [30, 40],
    ])
  ).toEqual({ kind: "rect", rect: [20, 10, 40, 30] });
});

describe("assertFeatureIdentifier", () => {
  test("accepts a string id and returns a fresh snapshot", () => {
    const identifier = { source: "routes", id: "route-1" };
    const snapshot = assertFeatureIdentifier(identifier);

    expect(snapshot).toEqual(identifier);
    expect(snapshot).not.toBe(identifier);
    expect(Object.hasOwn(snapshot, "sourceLayer")).toBe(false);
  });

  test("accepts a numeric id with a source layer and isolates caller mutation", () => {
    const identifier = { source: "tiles", id: 7, sourceLayer: " buildings " };
    const snapshot = assertFeatureIdentifier(identifier);

    expect(snapshot).toEqual({
      source: "tiles",
      id: 7,
      sourceLayer: " buildings ",
    });
    expect(snapshot).not.toBe(identifier);

    identifier.source = "changed";
    identifier.id = 99;
    identifier.sourceLayer = "roads";

    expect(snapshot).toEqual({
      source: "tiles",
      id: 7,
      sourceLayer: " buildings ",
    });
  });

  test("reads identifier getters only once", () => {
    let sourceReads = 0;
    let idReads = 0;
    let sourceLayerReads = 0;
    const identifier = {
      get source() {
        sourceReads += 1;
        return sourceReads === 1 ? "tiles" : "";
      },
      get id() {
        idReads += 1;
        return idReads === 1 ? 7 : (undefined as unknown as number);
      },
      get sourceLayer() {
        sourceLayerReads += 1;
        return sourceLayerReads === 1 ? "buildings" : undefined;
      },
    };

    expect(assertFeatureIdentifier(identifier)).toEqual({
      source: "tiles",
      id: 7,
      sourceLayer: "buildings",
    });
    expect(sourceReads).toBe(1);
    expect(idReads).toBe(1);
    expect(sourceLayerReads).toBe(1);
  });

  test.each([null, undefined, [], ["routes", 1], "routes", 42])(
    "rejects a non-object or array identifier: %p",
    (value) => {
      expect(() =>
        assertFeatureIdentifier(value as unknown as FeatureIdentifier)
      ).toThrow("nonempty string");
    }
  );

  test("rejects an empty source", () => {
    expect(() => assertFeatureIdentifier({ source: "", id: 1 })).toThrow(
      "nonempty string"
    );
  });

  test.each(["", null, 42])("rejects %j as sourceLayer", (value) => {
    expect(() =>
      assertFeatureIdentifier({ source: "tiles", id: 7, sourceLayer: value })
    ).toThrow("sourceLayer must be a nonempty string");
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

describe("copyValidatedFeatureState", () => {
  test("accepts and copies JSON values including nested objects and arrays", () => {
    const state = {
      selected: true,
      count: 2,
      name: "route",
      tags: ["a", "b"],
      empty: [],
      meta: { depth: { level: 1 } },
    };
    const copied = copyValidatedFeatureState(state);

    expect(copied).toEqual(state);
    expect(copied).not.toBe(state);
  });

  test.each([[], [1], null, undefined, "selected", 42, true])(
    "rejects a top-level array, null, or primitive state: %p",
    (value) => {
      expect(() =>
        copyValidatedFeatureState(value as unknown as FeatureState)
      ).toThrow("must be an object");
    }
  );

  test("rejects a null value", () => {
    expect(() =>
      copyValidatedFeatureState({ selected: null as unknown as boolean })
    ).toThrow('Feature state key "selected"');
  });

  test("rejects an undefined value", () => {
    expect(() =>
      copyValidatedFeatureState({ selected: undefined as unknown as boolean })
    ).toThrow("Feature state key");
  });

  test("rejects a non-finite number", () => {
    expect(() => copyValidatedFeatureState({ score: Number.NaN })).toThrow(
      "non-finite"
    );
    expect(() =>
      copyValidatedFeatureState({ score: Number.POSITIVE_INFINITY })
    ).toThrow("non-finite");
    expect(() =>
      copyValidatedFeatureState({ score: Number.NEGATIVE_INFINITY })
    ).toThrow("non-finite");
  });

  test("rejects non-JSON primitive types", () => {
    expect(() =>
      copyValidatedFeatureState({
        handler: (() => {}) as unknown as boolean,
      })
    ).toThrow('Feature state key "handler"');
    expect(() =>
      copyValidatedFeatureState({
        token: Symbol("state") as unknown as string,
      })
    ).toThrow('Feature state key "token"');
    expect(() =>
      copyValidatedFeatureState({
        large: 1n as unknown as number,
      })
    ).toThrow('Feature state key "large"');
  });

  test("rejects a null nested in an object", () => {
    expect(() =>
      copyValidatedFeatureState({
        meta: { depth: null as unknown as number },
      })
    ).toThrow("non-finite");
  });

  test("rejects a null array element", () => {
    expect(() =>
      copyValidatedFeatureState({ tags: [1, null as unknown as number] })
    ).toThrow("non-finite");
  });

  test("rejects an array consisting only of empty slots", () => {
    expect(() =>
      // eslint-disable-next-line unicorn/no-new-array -- A sparse array is intentional invalid input; filling its hole would weaken this validation test.
      copyValidatedFeatureState({ values: new Array<number>(1) })
    ).toThrow('Feature state key "values"');
  });

  test("rejects a sparse array hole even with an inherited index property", () => {
    // eslint-disable-next-line unicorn/no-new-array -- A sparse array is intentional invalid input; filling its hole would weaken this validation test.
    const values = new Array<string>(1);
    const inherited = Object.assign(
      Object.create(Array.prototype) as Record<number, string>,
      { 0: "inherited" }
    );
    Object.setPrototypeOf(values, inherited);

    expect(() => copyValidatedFeatureState({ values })).toThrow(
      'Feature state key "values"'
    );
  });

  test.each([0, 1, 2])("rejects an array with a hole at index %i", (index) => {
    const values = [1, 2, 3];
    delete values[index];

    expect(() => copyValidatedFeatureState({ values })).toThrow(
      'Feature state key "values"'
    );
    expect(values).toHaveLength(3);
    expect(Object.hasOwn(values, index)).toBe(false);
  });

  test("rejects sparse arrays nested inside objects", () => {
    expect(() =>
      // eslint-disable-next-line unicorn/no-new-array -- A sparse array is intentional invalid input; filling its hole would weaken this validation test.
      copyValidatedFeatureState({ meta: { values: new Array<number>(1) } })
    ).toThrow('Feature state key "meta"');
  });

  test("rejects sparse arrays nested inside arrays", () => {
    expect(() =>
      // eslint-disable-next-line unicorn/no-new-array -- A sparse array is intentional invalid input; filling its hole would weaken this validation test.
      copyValidatedFeatureState({ values: [[1], new Array<number>(1)] })
    ).toThrow('Feature state key "values"');
  });

  test("reads top-level, nested, and array-element getters only once", () => {
    let topReads = 0;
    let nestedReads = 0;
    let elementReads = 0;
    const items: number[] = [];
    Object.defineProperty(items, 0, {
      enumerable: true,
      get: () => {
        elementReads += 1;
        return elementReads === 1 ? 42 : Number.NaN;
      },
    });
    const state = {
      get count() {
        topReads += 1;
        return topReads === 1 ? 1 : Number.NaN;
      },
      nested: {
        get label() {
          nestedReads += 1;
          return nestedReads === 1 ? "ok" : (null as unknown as string);
        },
      },
      items,
    };

    expect(copyValidatedFeatureState(state)).toEqual({
      count: 1,
      nested: { label: "ok" },
      items: [42],
    });
    expect(topReads).toBe(1);
    expect(nestedReads).toBe(1);
    expect(elementReads).toBe(1);
  });

  test("preserves __proto__ keys as own data properties without mutating prototypes", () => {
    const nested = JSON.parse('{"__proto__":{"polluted":true}}') as Record<
      string,
      FeatureState
    >;
    const copied = copyValidatedFeatureState({ nested });
    const copiedNested = copied.nested as Record<string, unknown>;

    expect(Object.getPrototypeOf(copiedNested)).toBe(Object.prototype);
    expect(Object.hasOwn(copiedNested, "__proto__")).toBe(true);
    expect(copiedNested["__proto__"]).toEqual({ polluted: true });
    expect((copiedNested as { polluted?: boolean }).polluted).toBeUndefined();
  });

  test("ignores elements appended by an array getter during copying", () => {
    const values: number[] = [0, 2];
    Object.defineProperty(values, 0, {
      enumerable: true,
      configurable: true,
      get() {
        values.push(3);
        return 1;
      },
    });

    expect(copyValidatedFeatureState({ values })).toEqual({ values: [1, 2] });
  });

  test("rejects an array shortened by an element getter during copying", () => {
    const values: number[] = [0, 2];
    Object.defineProperty(values, 0, {
      enumerable: true,
      configurable: true,
      get() {
        values.pop();
        return 1;
      },
    });

    expect(() => copyValidatedFeatureState({ values })).toThrow(
      'Feature state key "values"'
    );
  });
});

describe("featureStateFromWrapper", () => {
  test.each([{ value: [] }, { value: [1] }, { value: [{ selected: true }] }])(
    "rejects a top-level array result: $value",
    ({ value }) => {
      expect(() => featureStateFromWrapper(value)).toThrow("must be an object");
    }
  );

  test("returns a present state object unchanged", () => {
    const state = { selected: true, values: [1, 2] };

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

test("feature-state dispatch copies validated nested values before a caller can mutate them", () => {
  const state = { nested: { selected: true }, values: [1, { count: 2 }] };
  const copied = copyValidatedFeatureState(state);
  state.nested.selected = false;
  state.values.push(3);
  (state.values[1] as { count: number }).count = 9;
  expect(copied).toEqual({
    nested: { selected: true },
    values: [1, { count: 2 }],
  });
});
