import { describe, expect, test } from "vite-plus/test";

import {
  assertBounds,
  boundsFromFlat,
  boundsFromGeographic,
  boundsFromRnmapboxVisible,
  finiteNumber,
  normalizePadding,
  toFlatBounds,
} from "../src/adapters/shared/wrapper-values.js";

describe("camera conversion", () => {
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
