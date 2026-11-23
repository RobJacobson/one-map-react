import { describe, expect, test } from "vite-plus/test";

import {
  assertBounds,
  boundsFromFlat,
  boundsFromGeographic,
  boundsFromRnmapboxVisible,
  finiteNumber,
  lngLatFromWrapper,
  normalizePadding,
  pointFromWrapper,
  toFlatBounds,
} from "../src/adapters/shared/wrapper-values.js";

describe("camera conversion", () => {
  test("coordinates accept wrapper fields when a finite tuple is unavailable", () => {
    expect(lngLatFromWrapper({ lng: 1, lat: 2 })).toEqual([1, 2]);
    expect(lngLatFromWrapper({ lng: NaN, lon: 1, lat: 2 })).toEqual([1, 2]);
    expect(
      lngLatFromWrapper(Object.assign([NaN, 2], { lng: 1, lat: 2 }))
    ).toEqual([1, 2]);
  });

  test("a point tuple contains the finite coordinates read from its getters", () => {
    const point = [0, 0];
    let xReads = 0;
    let yReads = 0;
    Object.defineProperties(point, {
      0: {
        get: () => {
          xReads += 1;
          return xReads === 1 ? 10 : NaN;
        },
      },
      1: {
        get: () => {
          yReads += 1;
          return yReads === 1 ? 20 : NaN;
        },
      },
    });

    const snapshot = pointFromWrapper(point);

    expect(snapshot).toEqual([10, 20]);
    expect(snapshot).not.toBe(point);
    snapshot[0] = 30;
    expect(snapshot).toEqual([30, 20]);
  });

  test("points require two finite tuple coordinates or finite x and y fields", () => {
    expect(pointFromWrapper({ x: 0, y: 2 })).toEqual([0, 2]);
    expect(pointFromWrapper(Object.assign([NaN, 2], { x: 0, y: 2 }))).toEqual([
      0, 2,
    ]);
    for (const value of [[1, 2, 3], [1, Infinity], { x: 1, y: "2" }]) {
      expect(() => pointFromWrapper(value)).toThrow(
        "A map point must contain x and y."
      );
    }
  });

  test("numeric wrapper results stay finite numbers without coercion", () => {
    expect(finiteNumber(0, "Map zoom")).toBe(0);
    expect(finiteNumber(-2.5, "Map zoom")).toBe(-2.5);
    for (const value of [NaN, Infinity, -Infinity, "3", null, undefined]) {
      expect(() => finiteNumber(value, "Cluster expansion zoom")).toThrow(
        "Cluster expansion zoom must be a finite number."
      );
    }
  });

  test("padding fills missing sides and a single number fills every side", () => {
    expect(normalizePadding({ top: 4 })).toEqual({
      top: 4,
      right: 0,
      bottom: 0,
      left: 0,
    });
    expect(normalizePadding(6)).toEqual({
      top: 6,
      right: 6,
      bottom: 6,
      left: 6,
    });
  });

  test("antimeridian bounds keep west greater than east", () => {
    const bounds = [
      [170, -10],
      [-170, 10],
    ] as const;

    expect(toFlatBounds(bounds)).toEqual([170, -10, -170, 10]);
    expect(boundsFromFlat([170, -10, -170, 10])).toEqual([
      [170, -10],
      [-170, 10],
    ]);
  });

  test("invalid bounds are rejected", () => {
    expect(() => assertBounds([[-122.34], [-122, 47]] as never)).toThrow(
      "Bounds must be [[west, south], [east, north]]."
    );
  });

  test("RNMapbox visible bounds are northeast then southwest", () => {
    expect(
      boundsFromRnmapboxVisible([
        [-122.2, 47.7],
        [-122.4, 47.5],
      ])
    ).toEqual([
      [-122.4, 47.5],
      [-122.2, 47.7],
    ]);
  });

  test("web bounds read corner methods and reject a two-element array", () => {
    expect(
      boundsFromGeographic({
        getWest: () => 170,
        getSouth: () => -10,
        getEast: () => -170,
        getNorth: () => 10,
      })
    ).toEqual([
      [170, -10],
      [-170, 10],
    ]);
    expect(() =>
      boundsFromGeographic([
        [170, -10],
        [-170, 10],
      ])
    ).toThrow("Map bounds must be [west, south, east, north]");
  });
});
