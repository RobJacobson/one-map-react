import { expect, test, vi } from "vite-plus/test";

import { validatePosition } from "../src/adapters/shared/location-values.js";
import type { LngLat } from "../src/contracts/camera-types.js";

test("display validation preserves measured units and rejects invalid measurements", () => {
  const position = {
    lngLat: [1, 2] as const,
    timestamp: 1000,
    accuracy: 25,
    altitude: -20,
    altitudeAccuracy: 3,
    speed: 4,
    course: 45,
  };
  expect(validatePosition(position)).toEqual(position);
  expect(validatePosition({ lngLat: [0, 0] })).toStrictEqual({
    lngLat: [0, 0],
  });
  expect(() => validatePosition({ lngLat: [NaN, 0] })).toThrow("coordinate");
  expect(() => validatePosition({ lngLat: [0, 91] })).toThrow("latitude");
  for (const name of [
    "accuracy",
    "timestamp",
    "altitudeAccuracy",
    "speed",
  ] as const) {
    for (const value of [-1, Infinity, NaN])
      expect(() => validatePosition({ lngLat: [0, 0], [name]: value })).toThrow(
        name
      );
  }
  for (const name of ["altitude", "course"] as const)
    expect(() => validatePosition({ lngLat: [0, 0], [name]: NaN })).toThrow(
      name
    );
});

test.each([
  ["accuracy", 0],
  ["timestamp", 0],
  ["altitudeAccuracy", 0],
  ["speed", 0],
  ["altitude", -20],
  ["course", -45],
] as const)("display uses the first reading of %s", (name, value) => {
  const read = vi.fn(() => NaN).mockReturnValueOnce(value);
  const position = {
    lngLat: [1, 2] as const,
    get [name]() {
      return read();
    },
  };

  expect(validatePosition(position)).toStrictEqual({
    lngLat: [1, 2],
    [name]: value,
  });
  expect(read).toHaveBeenCalledTimes(1);
});

test("display uses the first reading of each coordinate", () => {
  const longitude = vi.fn(() => Infinity).mockReturnValueOnce(1);
  const latitude = vi.fn(() => NaN).mockReturnValueOnce(2);
  const lngLat: LngLat = [1, 2];
  Object.defineProperties(lngLat, {
    0: { get: longitude },
    1: { get: latitude },
  });
  const read = vi.fn((): LngLat => [NaN, NaN]).mockReturnValueOnce(lngLat);
  const position = {
    get lngLat() {
      return read();
    },
  };

  expect(validatePosition(position)).toStrictEqual({ lngLat: [1, 2] });
  expect(read).toHaveBeenCalledTimes(1);
  expect(longitude).toHaveBeenCalledTimes(1);
  expect(latitude).toHaveBeenCalledTimes(1);
});

test("display preserves measurements exposed by prototype getters", () => {
  class Position {
    get lngLat(): LngLat {
      return [1, 2];
    }

    get accuracy() {
      return 30;
    }
  }

  expect(validatePosition(new Position())).toStrictEqual({
    lngLat: [1, 2],
    accuracy: 30,
  });
});
