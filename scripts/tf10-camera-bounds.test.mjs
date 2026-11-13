import assert from "node:assert/strict";

import { runCameraBoundsAcceptance } from "./tf10-camera-bounds.mjs";

const originalNow = Date.now;
let clock = 0;
Date.now = () => (clock += 1000);
try {
  for (const defect of [
    undefined,
    "omit-bounds",
    "omit-replacement",
    "omit-removal",
    "reset-drift",
  ]) {
    let bounds;
    let center = [0, 0];
    const action = async (name, value) => {
      if (name === "camera-bounds") {
        if (value.enabled === false) {
          if (defect !== "omit-removal") bounds = undefined;
        } else if (!(value.shifted && defect === "omit-replacement")) {
          bounds = value.shifted
            ? [
                [30, 30],
                [50, 50],
              ]
            : [
                [-20, -20],
                [20, 20],
              ];
        }
      }
      if (name === "bounds-command") {
        center =
          value.target === "north-west"
            ? [-100, 65]
            : value.target === "south-east"
              ? [100, -65]
              : defect === "reset-drift"
                ? [38, 45]
                : [100, 50];
        if (bounds && defect !== "omit-bounds")
          center = center.map((coordinate, axis) =>
            Math.min(bounds[1][axis], Math.max(bounds[0][axis], coordinate))
          );
      }
      if (name === "camera-read")
        return { cameraBounds: bounds, center, zoom: 5 };
      return true;
    };
    if (defect)
      await assert.rejects(
        runCameraBoundsAcceptance({ action }),
        defect === "reset-drift"
          ? /Camera reset after clearing bounds did not settle/
          : defect === "omit-removal"
            ? /Camera bounds commit undefined did not settle/
            : defect === "omit-replacement"
              ? /Camera bounds commit \[\[30,30\],\[50,50\]\] did not settle/
              : /Camera north-west with bounds .* did not settle/
      );
    else {
      const result = await runCameraBoundsAcceptance({ action });
      assert.equal(result.observations.length, 4);
      assert(
        result.observations.every(
          (observation) =>
            Number.isFinite(observation.elapsedMs) && observation.elapsedMs > 0
        )
      );
    }
  }
} finally {
  Date.now = originalNow;
}
console.log(
  "Camera bounds acceptance rejects omitted, stale and unremoved geographic bounds."
);

const { runCameraPanBoundsAcceptance } =
  await import("./tf10-camera-bounds.mjs");
clock = 0;
Date.now = () => (clock += 1000);
try {
  for (const defect of [
    undefined,
    "ignores-pan-bounds",
    "retains-pan-bounds",
  ]) {
    let bounds;
    let retained = false;
    let center = [0, 0];
    const action = async (name, value) => {
      if (name === "camera-bounds") {
        bounds =
          value.enabled === false
            ? undefined
            : [
                [-20, -20],
                [20, 20],
              ];
        retained = value.enabled === false && defect === "retains-pan-bounds";
      }
      if (name === "bounds-command") center = [-19, 19];
      if (name === "camera-read")
        return { cameraBounds: bounds, center, zoom: 4 };
      return true;
    };
    const driveGesture = async () => {
      center =
        (bounds && defect !== "ignores-pan-bounds") || retained
          ? [-19, 19]
          : [-24, 24];
    };
    if (defect)
      await assert.rejects(
        runCameraPanBoundsAcceptance({ action, driveGesture }),
        /did not settle/
      );
    else
      assert.equal(
        (await runCameraPanBoundsAcceptance({ action, driveGesture })).status,
        "passed"
      );
  }
} finally {
  Date.now = originalNow;
}
console.log(
  "Paired panning acceptance rejects ignored limits and limits retained after removal."
);
