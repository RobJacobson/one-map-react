import assert from "node:assert/strict";

import {
  captureInclusion,
  observeCoveragePixels,
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
