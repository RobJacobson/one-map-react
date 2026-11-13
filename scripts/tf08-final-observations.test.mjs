import assert from "node:assert/strict";

import {
  captureInclusion,
  observeCoveragePixels,
  observeNativeCoveragePixels,
} from "./tf08-final-observations.mjs";

const pixels = observeCoveragePixels({
  data: Uint8Array.from([
    0, 255, 0, 255, 0, 122, 255, 255, 240, 240, 20, 255, 230, 230, 230, 255,
    255, 255, 0, 0,
  ]),
});
assert.deepEqual(pixels, { green: 1, blue: 1, yellow: 1, bright: 1 });
const baseline = { live: { green: 0 }, exported: { green: 0 } };
assert.throws(
  () => captureInclusion(baseline, { green: 0 }, { green: 500 }, "green"),
  /not established on screen/
);
assert.equal(
  captureInclusion(baseline, { green: 500 }, { green: 0 }, "green").included,
  false
);
assert.equal(
  captureInclusion(baseline, { green: 500 }, { green: 500 }, "green").included,
  true
);
console.log("TF08 final capture observation regressions passed.");

// A blue status icon can exceed the puck's pixel count; only map pixels count.
const viewportImage = (puck) => {
  const width = 24;
  const height = 24;
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1)
    for (let x = 0; x < width; x += 1) {
      const blue =
        (!puck && y < 8) || (puck && x >= 8 && x < 17 && y >= 10 && y < 19);
      data.set(
        blue ? [0, 122, 255, 255] : [10, 20, 30, 255],
        (y * width + x) * 4
      );
    }
  return { width, height, data };
};
const device = { scale: 2, mapFrame: { x: 0, y: 4, width: 12, height: 8 } };
assert(
  observeCoveragePixels(viewportImage(true)).blue -
    observeCoveragePixels(viewportImage(false)).blue <
    0,
  "Whole-screen subtraction reproduces the false failure."
);
const beforePuck = observeNativeCoveragePixels(viewportImage(false), device);
const withPuck = observeNativeCoveragePixels(viewportImage(true), device);
assert.equal(beforePuck.blue, 0);
assert.equal(withPuck.blue, 81);
assert.equal(
  captureInclusion(
    { live: beforePuck, exported: beforePuck },
    withPuck,
    withPuck,
    "blue"
  ).included,
  true
);
assert.throws(
  () =>
    captureInclusion(
      { live: beforePuck, exported: beforePuck },
      beforePuck,
      withPuck,
      "blue"
    ),
  /not established/
);
for (const mapFrame of [
  { x: -1, y: 0, width: 12, height: 8 },
  { x: 0, y: 0, width: 0, height: 8 },
  { x: 0, y: 10, width: 12, height: 8 },
  { x: Number.NaN, y: 0, width: 12, height: 8 },
  { x: "0", y: 0, width: 12, height: 8 },
])
  assert.throws(() =>
    observeNativeCoveragePixels(viewportImage(true), { scale: 2, mapFrame })
  );
console.log(
  "PASS measured native viewport excludes OS blue pixels, retains puck pixels, rejects missing puck and invalid bounds."
);

for (const scale of [0, Number.NaN, Number.POSITIVE_INFINITY])
  assert.throws(() =>
    observeNativeCoveragePixels(viewportImage(true), { ...device, scale })
  );
