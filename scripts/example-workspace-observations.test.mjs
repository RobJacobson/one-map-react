import assert from "node:assert/strict";

import {
  hasInvalidTextChildren,
  fixtureBackgroundVisible,
  nativeLifecyclePassed,
  webHillshadeSettled,
  mapPixelSummary,
  redactWorkspaceDiagnostic,
  workspaceWebPorts,
} from "./example-workspace-observations.mjs";

assert(
  hasInvalidTextChildren(
    "Unexpected text node: Read camera. A text node cannot be a child of a <View>."
  )
);
assert(!hasInvalidTextChildren("Service Unavailable (503)"));

assert.equal(
  redactWorkspaceDiagnostic(
    "pk.abc.def access_token=private&other=ok sk.private"
  ),
  "[redacted] access_token=[redacted]&other=ok [redacted]"
);
const image = { width: 200, height: 200, data: Buffer.alloc(200 * 200 * 4) };
assert.equal(mapPixelSummary(image).samples, 0);
for (let index = 0; index < image.data.length; index += 4)
  image.data.set([30, 50, 75, 255], index);
assert.equal(mapPixelSummary(image).colors, 1);
// Text and controls above the map observation region cannot pass a blank basemap.
for (let y = 0; y < 60; y += 1) {
  for (let x = 0; x < 200; x += 1)
    image.data.set([x, y * 4, 255, 255], (y * 200 + x) * 4);
}
assert.equal(mapPixelSummary(image).colors, 1);
for (let y = 80; y < 170; y += 1) {
  for (let x = 20; x < 180; x += 1)
    image.data.set([x, y, (x + y) % 256, 255], (y * 200 + x) * 4);
}
assert(mapPixelSummary(image).colors > 30);
const vite = workspaceWebPorts("vite"),
  expo = workspaceWebPorts("expo-web");
assert.equal(new Set([...Object.values(vite), ...Object.values(expo)]).size, 6);
assert.throws(() => workspaceWebPorts("native"));
console.log(
  "PASS workspace observation guard: blank/control-only maps reject, actual map region is measured, credentials redact, web ports are isolated."
);

assert(
  nativeLifecyclePassed(
    "TF03 loads=2 styles=2 errors=1 error=load-failed remount=-122.34,47.61 phase=done"
  )
);
for (const line of [
  "TF03 loads=0 styles=0 errors=0 error=load-timeout remount=pending phase=done",
  "TF03 loads=2 styles=2 errors=1 error=load-failed remount=0,0 phase=done",
  "TF03 loads=2 styles=2 errors=1 error=load-failed remount=NaN,47.61 phase=done",
  "TF03 loads=2 styles=2 errors=1 error=load-failed remount=-122.34,Infinity phase=done",
  "TF03 loads=2 styles=2 errors=1 error=load-failed remount=-122.32,47.64 phase=done",
  "TF03 loads=2 styles=2 errors=1 error=load-failed remount=anything phase=done",
  "TF03 loads=2 styles=2 errors=1 error=load-failed remount=-122.34,47.61,0 phase=done",

  "TF03 loads=2 styles=2 errors=1 error=load-failed remount=no-move phase=done",
  "TF03 loads=2 styles=2 errors=1 error=load-failed remount=-122.34,47.61 phase=await-failure",
])
  assert(!nativeLifecyclePassed(line));

const painted = { width: 100, height: 100, data: Buffer.alloc(100 * 100 * 4) };
const canvasBounds = { x: 0, y: 0, width: 100, height: 100 };
assert(!fixtureBackgroundVisible(painted, canvasBounds, "#e2e8f0"));
for (let index = 0; index < painted.data.length; index += 4)
  painted.data.set([226, 232, 240, 255], index);
assert(fixtureBackgroundVisible(painted, canvasBounds, "#e2e8f0"));
assert(!fixtureBackgroundVisible(painted, canvasBounds, "#ffffff"));
assert.throws(() =>
  fixtureBackgroundVisible(painted, { ...canvasBounds, width: 0 }, "#e2e8f0")
);

assert(
  webHillshadeSettled(
    2,
    { renderedFrames: 3, shade: true, frameShade: true },
    true
  )
);
assert(
  webHillshadeSettled(
    3,
    { renderedFrames: 4, shade: false, frameShade: false },
    false
  )
);
// Removal in the style alone cannot accept an older frame that still drew the layer.
assert(
  !webHillshadeSettled(
    3,
    { renderedFrames: 4, shade: false, frameShade: true },
    false
  )
);
assert(
  !webHillshadeSettled(
    3,
    { renderedFrames: 3, shade: false, frameShade: false },
    false
  )
);
assert(
  !webHillshadeSettled(
    3,
    { renderedFrames: 4, shade: true, frameShade: false },
    false
  )
);
assert(!webHillshadeSettled(3, undefined, false));
