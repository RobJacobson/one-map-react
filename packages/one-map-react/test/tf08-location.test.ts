import { expect, test } from "vite-plus/test";

import { validatePosition } from "../src/adapters/shared/location-values.js";

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
