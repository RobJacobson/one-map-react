import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const packet = JSON.parse(
  readFileSync(
    process.env.API36_POPUP_PACKET ??
      new URL(
        "../records/evidence/revised-api-u26-mapbox-android-api36-resume-preparation.json",
        import.meta.url
      )
  )
);
const protocol = packet.popupObservationProtocol;
assert(
  protocol,
  "Popup recipe must establish a visible anchor before zoom observation."
);
assert.equal(protocol.zoomBefore, 11);
assert.equal(protocol.zoomAfter, 10);
const width = 411;
const scale = 2.625;
const popup = [-122.3, 47.63];
const center = [-122.34, 47.61];
const x = (zoom) =>
  width / 2 + ((popup[0] - center[0]) / 360) * 512 * 2 ** zoom;
assert(
  Math.abs(x(11) * scale - (694 + 997) / 2) < 2,
  "Saved before bounds agree with fixed fixture projection."
);
assert(
  x(12) > width,
  "Attempt24 zoom-in drove the fixed anchor beyond the viewport."
);
const clipped = x(12) > width ? -1 : x(12) * scale;
assert.equal(clipped, -1);
assert.equal(
  532 + clipped,
  531,
  "SDK offscreen sentinel explains saved overlay bottom."
);
for (const zoom of [protocol.zoomBefore, protocol.zoomAfter]) {
  const halfBubble = 303 / 2;
  assert(x(zoom) * scale - halfBubble > 0);
  assert(
    x(zoom) * scale + halfBubble < 1080,
    "Entire bubble remains horizontally visible."
  );
}
for (const [index, step] of protocol.steps.entries()) {
  const previous =
    index === 0 ? "initial" : `steps.${protocol.steps[index - 1].name}.after`;
  assert(
    step.before?.length || step.beforeFrameFrom === previous,
    "Each mutation requires explicit immediately preceding settled frame provenance."
  );
  assert(
    step.after.length,
    "Each mutation requires a fresh settled after frame."
  );
  assert(step.after.some((command) => command.includes("uiautomator dump")));
  assert(step.after.some((command) => command.includes(" status")));
  if (["pan", "remount", "zoom-out"].includes(step.name))
    assert(step.after.some((command) => command.includes("screencap")));
}
assert(protocol.steps.some((step) => step.operation.includes("Zoom out")));
console.log(
  "Saved projection reproduces the offscreen precondition; corrected zoom11->10 keeps the popup visible. No renderer executed."
);
