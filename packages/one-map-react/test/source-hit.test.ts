import { describe, expect, test } from "@jest/globals";

import {
  sourceHitFromMapbox,
  sourceHitFromMaplibre,
} from "../src/adapters/shared/source-hit.js";

describe("native source activation geometry", () => {
  test("renames Mapbox point and coordinate fields without changing hit features", () => {
    const features = [{ id: 1 }];
    expect(
      sourceHitFromMapbox({
        coordinates: { longitude: 2, latitude: 3 },
        point: { x: 4, y: 5 },
        features,
      })
    ).toEqual({ lngLat: [2, 3], point: [4, 5], features });
  });
  test("copies MapLibre tuples so later wrapper mutation cannot change an event", () => {
    const lngLat = [2, 3];
    const point = [4, 5];
    const event = sourceHitFromMaplibre({ lngLat, point, features: [] });
    lngLat[0] = 9;
    point[0] = 8;
    expect(event).toEqual({ lngLat: [2, 3], point: [4, 5], features: [] });
  });
  test("rejects malformed source coordinates and points", () => {
    expect(() =>
      sourceHitFromMaplibre({ lngLat: [NaN, 3], point: [4, 5], features: [] })
    ).toThrow("coordinate");
    expect(() =>
      sourceHitFromMapbox({
        coordinates: { longitude: 2, latitude: 3 },
        point: { x: 4, y: Infinity },
        features: [],
      })
    ).toThrow("point");
  });
});
