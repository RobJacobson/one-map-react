import { expect, test } from "vite-plus/test";

import {
  normalizeElevation,
  validateTerrainCoordinate,
} from "../src/adapters/shared/terrain-values.js";
test.each([0, -10, 1200, null, undefined])(
  "normalizes elevation %s",
  (value) => {
    expect(normalizeElevation(value)).toBe(value ?? null);
  }
);
test("validates terrain coordinates before wrapper dispatch", () => {
  expect(() => validateTerrainCoordinate([Number.NaN, 0])).toThrow(RangeError);
  expect(() => validateTerrainCoordinate([0, 90])).not.toThrow();
});
