import assert from "node:assert/strict";

/** Verifies geographic clamping, replacement and removal using renderer getters. */
export const runCameraBoundsAcceptance = async ({ action }) => {
  const observations = [];
  const waitFor = (predicate, stage) => waitForCamera(action, predicate, stage);
  const within = (center, bounds) =>
    center.every(
      (coordinate, axis) =>
        coordinate >= bounds[0][axis] - 0.01 &&
        coordinate <= bounds[1][axis] + 0.01
    );
  const configure = async (value, bounds) => {
    await action("camera-bounds", value);
    await waitFor(
      (read) => JSON.stringify(read.cameraBounds) === JSON.stringify(bounds),
      `Camera bounds commit ${JSON.stringify(bounds)}`
    );
  };
  const command = async (target, bounds) => {
    const started = Date.now();
    assert.equal(await action("bounds-command", { target }), true);
    const read = await waitFor(
      (current) => within(current.center, bounds) && current.zoom >= 4.9,
      `Camera ${target} with bounds ${JSON.stringify(bounds)}`
    );
    observations.push({
      target,
      bounds,
      center: read.center,
      zoom: read.zoom,
      elapsedMs: Date.now() - started,
    });
  };
  const initial = [
    [-20, -20],
    [20, 20],
  ];
  await configure({ enabled: true }, initial);
  await command("north-west", initial);
  await command("south-east", initial);
  const shifted = [
    [30, 30],
    [50, 50],
  ];
  await configure({ enabled: true, shifted: true }, shifted);
  await command("north-west", shifted);
  await configure({ enabled: false }, undefined);
  const resetStarted = Date.now();
  assert.equal(await action("bounds-command", { target: "reset" }), true);
  const reset = await waitFor(
    (read) =>
      Math.abs(read.center[0] - 100) < 0.01 &&
      Math.abs(read.center[1] - 50) < 0.01,
    "Camera reset after clearing bounds"
  );
  observations.push({
    target: "reset",
    center: reset.center,
    zoom: reset.zoom,
    elapsedMs: Date.now() - resetStarted,
  });
  return { status: "passed", observations };
};

const waitForCamera = async (
  action,
  predicate,
  stage = "Geographic bounds"
) => {
  const deadline = Date.now() + 12000;
  let read;
  let stableSince;
  while (Date.now() < deadline) {
    read = await action("camera-read");
    assert(
      Array.isArray(read.center) &&
        read.center.length === 2 &&
        read.center.every(Number.isFinite)
    );
    assert(Number.isFinite(read.zoom));
    if (!predicate(read)) stableSince = undefined;
    else if (stableSince === undefined) stableSince = Date.now();
    else if (Date.now() - stableSince >= 700) return read;
    await new Promise((done) => setTimeout(done, 100));
  }
  throw new Error(`${stage} did not settle: ${JSON.stringify(read)}`);
};

/** Pairs the same real pan with and without geographic limits, including reset. */
export const runCameraPanBoundsAcceptance = async ({
  action,
  driveGesture,
}) => {
  const bounds = [
    [-20, -20],
    [20, 20],
  ];
  const within = (read) =>
    read.center.every(
      (coordinate, axis) =>
        coordinate >= bounds[0][axis] - 0.01 &&
        coordinate <= bounds[1][axis] + 0.01
    );
  await action("camera-bounds", { enabled: true });
  await waitForCamera(
    action,
    (read) => JSON.stringify(read.cameraBounds) === JSON.stringify(bounds),
    "Configured panning bounds"
  );
  await action("bounds-command", { target: "edge" });
  const boundedBefore = await waitForCamera(
    action,
    within,
    "Bounded camera target"
  );
  await driveGesture("bounded-pan", String(Date.now()));
  const boundedAfter = await waitForCamera(
    action,
    within,
    "Bounded physical pan"
  );
  await action("camera-bounds", { enabled: false });
  await waitForCamera(
    action,
    (read) => read.cameraBounds === undefined,
    "Cleared panning bounds"
  );
  await action("bounds-command", { target: "edge" });
  const unboundedBefore = await waitForCamera(
    action,
    (read) =>
      Math.abs(read.center[0] + 19) < 0.01 &&
      Math.abs(read.center[1] - 19) < 0.01,
    "Unbounded camera target"
  );
  await driveGesture("unbounded-pan", String(Date.now()));
  const unboundedAfter = await waitForCamera(
    action,
    (read) => !within(read),
    "Unbounded physical pan"
  );
  return {
    status: "passed",
    bounded: { before: boundedBefore, after: boundedAfter },
    unbounded: { before: unboundedBefore, after: unboundedAfter },
    observation:
      "Same real pan stayed inside bounds when configured and left them after removal.",
  };
};
