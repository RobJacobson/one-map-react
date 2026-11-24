import { expect, test } from "vite-plus/test";

import { normalizeElevation } from "../src/adapters/mapbox-native/map-results.js";

test.each([0, -10, 1200, null, undefined])(
  "normalizes elevation %s",
  (value) => {
    expect(normalizeElevation(value)).toBe(value ?? null);
  }
);
