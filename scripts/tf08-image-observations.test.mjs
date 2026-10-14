import assert from "node:assert/strict";

import { observeFixturePixels } from "./tf08-image-observations.mjs";

const samples = (...pixels) => ({
  width: pixels.length,
  height: 1,
  data: Uint8Array.from(pixels.flat()),
});

assert.deepEqual(
  observeFixturePixels(
    samples([255, 0, 0, 255], [0, 255, 0, 255], [255, 0, 255, 255])
  ),
  { width: 3, height: 1, red: 1, blue: 0, green: 1, navy: 0, magenta: 1 }
);
assert.equal(observeFixturePixels(samples([234, 51, 35, 255])).red, 1);
assert.equal(observeFixturePixels(samples([17, 25, 39, 255])).navy, 1);
assert.equal(
  observeFixturePixels(
    samples([59, 134, 247, 255], [231, 232, 234, 255], [0, 255, 0, 255])
  ).red,
  0
);

console.log("PASS TF08 fixture image observations: 4 cases");
