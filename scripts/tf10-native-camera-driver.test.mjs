import assert from "node:assert/strict";

import {
  assertCameraRead,
  assertFiniteCamera,
  runNativeCameraAcceptance,
} from "./tf10-native-camera-driver.mjs";

const base = { longitude: 0, latitude: 0, zoom: 2, bearing: 0, pitch: 0 };
assertFiniteCamera({ ...base, zoom: 3 });
assertCameraRead({
  moves: 1,
  ends: 0,
  origin: "user",
  userMoves: 1,
  userEnds: 0,
  lastUserOrigin: "user",
  lastUserViewState: base,
  center: [0, 0],
  zoom: 3,
  bearing: 0,
  pitch: 0,
  controlled: base,
  viewState: base,
});
assert.throws(() => assertFiniteCamera({ ...base, pitch: Number.NaN }));
assert.throws(() =>
  assertCameraRead({
    moves: 1,
    ends: 0,
    origin: "user",
    userMoves: 0,
    userEnds: 0,
    center: [0, 0],
    zoom: Infinity,
    bearing: 0,
    pitch: 0,
  })
);
assert.throws(() =>
  assertCameraRead({
    moves: 1,
    ends: 0,
    origin: "fromUserInteraction",
    userMoves: 0,
    userEnds: 0,
    center: [0, 0],
    zoom: 3,
    bearing: 0,
    pitch: 0,
  })
);

const clone = (value) => structuredClone(value);
const makeRead = (state) => ({
  ...state.events,
  dispatches: [],
  controlled: clone(state.controlled),
  clamp: state.clamp,
  center: [state.actual.longitude, state.actual.latitude],
  zoom: state.actual.zoom,
  bearing: state.actual.bearing,
  pitch: state.actual.pitch,
  viewState: clone(state.viewState),
  userMoves: state.userMoves,
  userEnds: state.userEnds,
  lastUserOrigin: state.lastUserOrigin,
  lastUserViewState: clone(state.lastUserViewState),
  lastUserProposal: clone(state.lastUserProposal),
});
const state = {
  actual: clone(base),
  controlled: clone(base),
  viewState: clone(base),
  clamp: false,
  accept: false,
  events: { moves: 0, ends: 0, origin: "unknown" },
  userMoves: 0,
  userEnds: 0,
  lastUserOrigin: undefined,
  lastUserViewState: undefined,
  lastUserProposal: undefined,
  gestures: [],
  actions: [],
};
const action = async (name, value = {}) => {
  state.actions.push(name);
  if (name === "controlled-camera") {
    state.accept = value.accept === true;
    state.clamp = value.clamp === true;
    const previousTarget = clone(state.controlled);
    state.controlled =
      value.enabled === false
        ? undefined
        : {
            ...clone(base),
            ...(value.target === "changed"
              ? { longitude: 5, latitude: 5 }
              : {}),
          };

    state.events = { moves: 1, ends: 0, origin: "programmatic" };
    state.userMoves = 0;
    state.userEnds = 0;
    state.lastUserOrigin = undefined;
    state.lastUserViewState = undefined;
    state.lastUserProposal = undefined;
    if (
      state.controlled &&
      JSON.stringify(previousTarget) !== JSON.stringify(state.controlled)
    )
      state.actual = clone(state.controlled);
    state.viewState = clone(state.actual);
    if (state.clamp) state.actual.zoom = 3;
  } else if (name === "camera-command") {
    state.actual =
      value.target === "reapply"
        ? clone(base)
        : { longitude: 10, latitude: 10, zoom: 3, bearing: 0, pitch: 0 };
    state.viewState = clone(state.actual);
    state.events.moves += 1;
    state.events.origin = "programmatic";
  }
  return name === "camera-read" ? makeRead(state) : true;
};
const driveGesture = (label) => {
  state.gestures.push(label);
  const before = clone(state.actual);
  const proposal = {
    longitude: before.longitude + 0.25,
    latitude: before.latitude + 0.15,
    zoom: state.clamp ? 3 : before.zoom + 0.2,
    bearing: before.bearing + 2,
    pitch: before.pitch + 1,
  };
  state.events.moves += 1;
  state.events.ends += 1;
  state.events.origin = "user";
  state.viewState = clone(proposal);
  state.actual = clone(proposal);
  state.userMoves += 1;
  state.userEnds += 1;
  state.lastUserOrigin = "user";
  state.lastUserViewState = clone(proposal);
  state.lastUserProposal = clone(proposal);
  if (state.accept) {
    // Deliberately commit before the driver's first observation poll.
    state.controlled = {
      ...clone(proposal),
      longitude: proposal.longitude + 0.08,
      latitude: proposal.latitude + 0.04,
    };
  }
  if (state.accept) {
    state.actual = clone(state.controlled);
    state.viewState = clone(state.actual);
    state.events.moves += 1;
    state.events.origin = "programmatic";
  } else if (label === "released") {
    // Inertia can continue beyond the direct user sample without a target.
    state.actual.longitude += 0.08;
    state.actual.latitude += 0.04;
    state.viewState = clone(state.actual);
    state.events.moves += 1;
    state.events.origin = "programmatic";
  }
  return Promise.resolve();
};
const result = await runNativeCameraAcceptance({ action, driveGesture });
assert.equal(result.status, "passed");
assert.deepEqual(state.gestures, [
  "unchanged-target",
  "accepted",
  "released",
  "fresh-after-clamp",
]);
assert.notDeepEqual(result.observations.unchanged.settled.center, [0, 0]);
assert.deepEqual(
  result.observations.equalTarget.center,
  result.observations.unchanged.settled.center
);
assert.deepEqual(result.observations.reapplied.center, [0, 0]);
assert.deepEqual(result.observations.changed.center, [5, 5]);
assert(result.observations.accepted.settled.controlled.longitude > 0);
assert.equal(result.observations.accepted.movement.origin, "programmatic");
assert(result.observations.released.controlled === undefined);
assert.notDeepEqual(result.observations.clamped.settled.center, [0, 0]);
assert.equal(result.observations.clamped.settled.zoom, 3);
assert.deepEqual(
  result.observations.commandAfterMovement.settled.center,
  [10, 10]
);
assert.equal(
  result.observations.commandAfterMovement.settled.controlled.zoom,
  2
);
assert(state.actions.at(-1) === "camera-read");
process.stdout.write(
  "TF10 native target/gesture/command protocol self-check passed\n"
);
