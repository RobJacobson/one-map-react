import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { join } from "node:path";

import { nativeControlledCamera as controlledCamera } from "../packages/example-map/src/scenarios/tf10-native-orientation.ts";
import { stopOwnedProcess } from "./native-smoke-process.mjs";

const cameraFields = ["longitude", "latitude", "zoom", "bearing", "pitch"];
const tolerance = {
  longitude: 0.02,
  latitude: 0.02,
  zoom: 0.1,
  bearing: 0.5,
  pitch: 0.5,
};
const delay = (durationMs) =>
  new Promise((resolve) => setTimeout(resolve, durationMs));

/** Observes native targets, real gestures, and explicit commands independently. */
export const runNativeCameraAcceptance = async ({ action, driveGesture }) => {
  const read = () => action("camera-read");
  const waitFor = async (description, predicate, timeoutMs = 8000) => {
    const deadline = Date.now() + timeoutMs;
    let latest;
    while (Date.now() < deadline) {
      latest = await read();
      assertCameraRead(latest);
      if (predicate(latest)) return latest;
      await delay(100);
    }
    throw new Error(`${description} timed out: ${JSON.stringify(latest)}`);
  };
  const arm = async (value, expectedClamp) => {
    await action("controlled-camera", value);
    await waitFor(
      "controlled camera commit",
      (current) =>
        current.clamp === expectedClamp &&
        (value.enabled === false
          ? current.controlled === undefined
          : sameCamera(current.controlled, controlledCamera))
    );
    return settle("controlled camera readback", (current) =>
      expectedClamp
        ? current.controlled &&
          current.clamp &&
          current.zoom >= 3 &&
          sameCameraExceptZoom(actualCamera(current), current.controlled)
        : value.enabled === false
          ? current.controlled === undefined
          : current.controlled &&
            sameCamera(actualCamera(current), current.controlled)
    );
  };
  const proposalAfterGesture = (baseline) =>
    waitFor(
      "real user gesture proposal",
      (current) =>
        current.userMoves > baseline.userMoves &&
        current.lastUserOrigin === "user" &&
        current.lastUserProposal &&
        !sameCamera(current.lastUserProposal, current.controlled)
    );
  const settle = async (label, predicate) => {
    const deadline = Date.now() + 8000;
    let latest;
    let quietSince;
    let quietMoves;
    while (Date.now() < deadline) {
      latest = await read();
      assertCameraRead(latest);
      if (!predicate(latest)) {
        quietSince = undefined;
        quietMoves = undefined;
      } else if (quietSince === undefined || quietMoves !== latest.moves) {
        quietSince = Date.now();
        quietMoves = latest.moves;
      } else if (Date.now() - quietSince >= 600) {
        return latest;
      }
      await delay(100);
    }
    throw new Error(`${label} did not settle: ${JSON.stringify(latest)}`);
  };

  const unchangedBefore = await arm({ enabled: true, accept: false }, false);
  const unchangedGesture = driveGesture("unchanged-target", randomUUID());
  const unchangedMovement = await proposalAfterGesture(unchangedBefore);
  await unchangedGesture;
  const unchanged = await settle(
    "movement with unchanged target",
    (current) =>
      current.controlled &&
      current.viewState &&
      sameCamera(current.controlled, unchangedBefore.controlled) &&
      sameCamera(actualCamera(current), current.viewState) &&
      !sameCamera(actualCamera(current), current.controlled)
  );
  assert.equal(
    dispatchCount(unchanged),
    dispatchCount(unchangedBefore),
    "movement automatically dispatched a camera correction"
  );
  await action("controlled-camera", { enabled: true, accept: false });
  const equalTarget = await settle(
    "equal target leaves observed camera",
    (current) =>
      sameCamera(current.controlled, unchangedBefore.controlled) &&
      sameCamera(actualCamera(current), actualCamera(unchanged))
  );
  assert.equal(
    dispatchCount(equalTarget),
    dispatchCount(unchanged),
    "an equal target automatically dispatched a camera command"
  );
  await action("camera-command", { target: "reapply" });
  const reapplied = await settle("explicit target reapplication", (current) =>
    sameCamera(actualCamera(current), controlledCamera)
  );
  await action("controlled-camera", { enabled: true, target: "changed" });
  const changed = await settle(
    "changed native target",
    (current) =>
      sameCamera(current.controlled, {
        ...controlledCamera,
        longitude: 5,
        latitude: 5,
      }) && sameCamera(actualCamera(current), current.controlled)
  );

  await arm({ enabled: true, accept: true }, false);
  const acceptedBefore = await read();
  const acceptedGesture = driveGesture("accepted", randomUUID());
  const acceptedMovement = await waitFor(
    "accepted user gesture",
    (current) =>
      current.userMoves > acceptedBefore.userMoves &&
      current.lastUserOrigin === "user" &&
      current.lastUserViewState &&
      differentPosition(current.lastUserViewState, acceptedBefore)
  );
  await acceptedGesture;
  const accepted = await settle(
    "accepted movement",
    (current) =>
      current.controlled &&
      current.viewState &&
      sameCamera(current.controlled, current.viewState) &&
      sameCamera(actualCamera(current), current.controlled)
  );
  assert(
    !sameCamera(accepted.controlled, controlledCamera),
    "accepted movement did not update the target"
  );

  const releasedBefore = await arm({ enabled: false }, false);
  const releasedGesture = driveGesture("released", randomUUID());
  await waitFor(
    "released user gesture",
    (current) =>
      current.userMoves > releasedBefore.userMoves &&
      current.lastUserOrigin === "user" &&
      current.lastUserViewState &&
      differentPosition(current.lastUserViewState, releasedBefore)
  );
  await releasedGesture;
  const released = await settle(
    "released camera",
    (current) =>
      current.controlled === undefined &&
      current.viewState &&
      sameCamera(actualCamera(current), current.viewState) &&
      !samePosition(current, releasedBefore)
  );

  const clampBefore = await arm(
    { enabled: true, accept: false, clamp: true },
    true
  );
  const clampGesture = driveGesture("fresh-after-clamp", randomUUID());
  const clampMovement = await proposalAfterGesture(clampBefore);
  await clampGesture;
  const clamped = await settle(
    "movement with native zoom constraint",
    (current) =>
      current.clamp &&
      current.zoom >= 3 &&
      current.controlled &&
      current.viewState &&
      sameCamera(actualCamera(current), current.viewState) &&
      !sameCameraExceptZoom(actualCamera(current), current.controlled)
  );
  const commandAcknowledged = await action("camera-command");
  assert.equal(
    commandAcknowledged,
    true,
    "public camera command was not acknowledged"
  );
  const command = await settle(
    "explicit command after movement",
    (current) =>
      sameCamera(current.controlled, controlledCamera) &&
      sameCamera(actualCamera(current), {
        longitude: 10,
        latitude: 10,
        zoom: 3,
        bearing: 0,
        pitch: 0,
      })
  );
  return {
    status: "passed",
    observations: {
      unchanged: { movement: unchangedMovement, settled: unchanged },
      equalTarget,
      reapplied,
      changed,
      accepted: { movement: acceptedMovement, settled: accepted },
      released,
      clamped: { movement: clampMovement, settled: clamped },
      commandAfterMovement: {
        acknowledged: commandAcknowledged,
        settled: command,
      },
    },
    verificationLimits: [
      "Camera reads observe settled movement; command acknowledgement alone does not prove animation completion.",
    ],
  };
};

/** Starts a real Android swipe and returns when its input process completes. */
export const createAndroidGestureDriver = async ({ serial, adb = "adb" }) => {
  assert(serial, "Set ANDROID_SERIAL to the assigned Android device.");
  const sizeText = await runCommand(adb, ["-s", serial, "shell", "wm", "size"]);
  const match = /(\d+)x(\d+)/.exec(sizeText);
  assert(match, `Could not read Android display size: ${sizeText}`);
  const width = Number(match[1]);
  const height = Number(match[2]);
  const points = [
    Math.round(width * 0.5),
    Math.round(height * 0.62),
    Math.round(width * 0.68),
    Math.round(height * 0.5),
    1100,
  ];
  return {
    driveGesture: () =>
      runCommand(adb, [
        "-s",
        serial,
        "shell",
        "input",
        "swipe",
        ...points.map(String),
      ]),
    close: async () => {},
  };
};

/** Starts the existing XCTest TapDriver and routes one real map swipe at a time. */
export const createIosGestureDriver = async ({
  bundleIdentifier,
  projectRoot,
  simulatorUDID,
}) => {
  assert(
    bundleIdentifier,
    "Set TF09_APPLICATION_ID to the assigned iOS bundle identifier."
  );
  assert(simulatorUDID, "Set TF09_IOS_UDID to the assigned simulator.");
  let current;
  const server = createServer((request, response) => {
    if (request.method === "GET" && request.url === "/tap") {
      response
        .writeHead(200, { "Content-Type": "text/plain" })
        .end(current?.command ?? "");
      return;
    }
    if (request.method === "POST" && request.url === "/done") {
      let body = "";
      request.on("data", (chunk) => (body += chunk));
      request.on("end", () => {
        if (body !== current?.command) {
          response.writeHead(409).end("gesture identity mismatch");
          return;
        }
        response.writeHead(204).end();
        current.resolve();
        current = undefined;
      });
      return;
    }
    response.writeHead(404).end();
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(8799, "127.0.0.1", resolve);
  });
  const xcodebuild = spawn(
    "xcodebuild",
    [
      "test",
      "-project",
      join(projectRoot, "TapDriver.xcodeproj"),
      "-scheme",
      "TapDriver",
      "-destination",
      `platform=iOS Simulator,id=${simulatorUDID}`,
      "-derivedDataPath",
      join(projectRoot, "..", "..", "..", "ios-tf09-tap-driver-derived"),
      "-only-testing:TapDriverUITests/TapDriver/testDriveTaps",
    ],
    { detached: true, stdio: ["ignore", "pipe", "pipe"] }
  );
  let output = "";
  xcodebuild.stdout.on("data", (chunk) => (output += chunk));
  xcodebuild.stderr.on("data", (chunk) => (output += chunk));
  const close = async () => {
    server.close();
    server.closeAllConnections();
    await stopOwnedProcess(xcodebuild);
  };
  try {
    await waitForDriverStart(xcodebuild, () => output);
  } catch (error) {
    await close();
    throw error;
  }
  return {
    driveGesture: (label, nonce) =>
      new Promise((resolve, reject) => {
        if (current) {
          reject(new Error("A native gesture is already in progress."));
          return;
        }
        const command = `gesture ${bundleIdentifier} 0.50 0.62 0.68 0.50 0.10 ${label}-${nonce}`;
        const timer = setTimeout(() => {
          current = undefined;
          reject(new Error("iOS gesture did not finish within 15 seconds."));
        }, 15000);
        current = {
          command,
          resolve: () => {
            clearTimeout(timer);
            resolve();
          },
        };
      }),
    close,
  };
};

/** Validates an independently returned TF09 map read before comparing cameras. */
export const assertCameraRead = (read) => {
  assert(read && Number.isInteger(read.moves) && Number.isInteger(read.ends));
  assert(Number.isInteger(read.userMoves) && Number.isInteger(read.userEnds));
  assert(Array.isArray(read.center) && read.center.length === 2);
  assert(read.center.every(Number.isFinite));
  assert([read.zoom, read.bearing, read.pitch].every(Number.isFinite));
  assert(["user", "programmatic", "unknown"].includes(read.origin));
  assert(read.lastUserOrigin === undefined || read.lastUserOrigin === "user");
  if (read.controlled) assertFiniteCamera(read.controlled);
  if (read.viewState) assertFiniteCamera(read.viewState);
  if (read.lastUserViewState) assertFiniteCamera(read.lastUserViewState);
  if (read.lastUserProposal) assertFiniteCamera(read.lastUserProposal);
};

/** Requires all five portable camera fields to be finite. */
export const assertFiniteCamera = (camera) => {
  assert(
    camera && cameraFields.every((field) => Number.isFinite(camera[field]))
  );
};

const dispatchCount = (read) =>
  read.dispatches.filter((event) => event.phase === "dispatch").length;
const actualCamera = (read) => ({
  longitude: read.center[0],
  latitude: read.center[1],
  zoom: read.zoom,
  bearing: read.bearing,
  pitch: read.pitch,
});
const samePosition = (left, right) =>
  close(left.center[0], right.center[0], tolerance.longitude) &&
  close(left.center[1], right.center[1], tolerance.latitude);
const differentPosition = (camera, read) =>
  !close(camera.longitude, read.center[0], tolerance.longitude) ||
  !close(camera.latitude, read.center[1], tolerance.latitude);
const sameCameraExceptZoom = (left, right) =>
  close(left.longitude, right.longitude, tolerance.longitude) &&
  close(left.latitude, right.latitude, tolerance.latitude) &&
  close(left.bearing, right.bearing, tolerance.bearing) &&
  close(left.pitch, right.pitch, tolerance.pitch);
const close = (left, right, allowed) => Math.abs(left - right) <= allowed;
const sameCamera = (left, right) =>
  left &&
  right &&
  cameraFields.every((field) =>
    close(left[field], right[field], tolerance[field])
  );
const runCommand = (file, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(file, args, { stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (chunk) => (output += chunk));
    child.stderr.on("data", (chunk) => (output += chunk));
    child.once("error", reject);
    child.once("close", (code) =>
      code === 0
        ? resolve(output)
        : reject(new Error(`${file} exited ${code}: ${output.slice(-1000)}`))
    );
  });
const waitForDriverStart = async (child, output) => {
  const deadline = Date.now() + 180000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null)
      throw new Error(`iOS TapDriver exited early: ${output()}`);
    if (output().includes("testDriveTaps]' started")) return;
    await delay(200);
  }
  throw new Error(`iOS TapDriver did not start: ${output().slice(-1500)}`);
};
