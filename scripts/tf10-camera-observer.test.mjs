import assert from "node:assert/strict";

import {
  cameraDispatchObservation as state,
  observeCameraDispatch,
  observeAcceptanceCamera,
} from "../packages/example-map/src/scenarios/tf10-camera-observer.ts";

const calls = [];
let resolveCommand;
const commandPromise = new Promise((done) => {
  resolveCommand = done;
});
const instance = {
  setCamera: (options) => {
    calls.push(options);
    return options.center[0] === 0 ? commandPromise : undefined;
  },
  other: "unchanged",
};
const component = {
  render: (_props, ref) => {
    ref(instance);
    return "real-render";
  },
};
observeCameraDispatch(component, "setCamera");
const ref = { current: null };
assert.equal(component.render({}, ref), "real-render");
assert.equal(ref.current.other, "unchanged");
const firstCommand = { center: [0, 0], zoom: 2 };
const command = { center: [10, 10], zoom: 3 };
assert.equal(ref.current.setCamera(firstCommand), commandPromise);
assert.equal(ref.current.setCamera(command), undefined);
assert.deepEqual(calls, [firstCommand, command]);
assert.deepEqual(
  state.events.slice(0, 2).map((event) => event.pending),
  [[], [1]]
);
await Promise.resolve();
assert(
  state.events.some((event) => event.id === 2 && event.phase === "acknowledged")
);
assert(state.pending.has(1));
resolveCommand();
await Promise.resolve();
assert.equal(state.pending.size, 0);
const failure = new Error("real wrapper failure");
const bad = {
  render: (_props, callback) => {
    callback({
      jumpTo: () => {
        throw failure;
      },
    });
  },
};
observeCameraDispatch({ type: bad }, "jumpTo");
let badRef;
bad.render({}, (value) => {
  badRef = value;
});
assert.throws(
  () => badRef.jumpTo(command),
  (error) => error === failure
);
assert.equal(state.events.at(-1).phase, "rejected");
assert.equal(state.pending.size, 0);
assert.throws(() => observeCameraDispatch({}, "jumpTo"), /forwardRef/);
console.log(
  "Camera observer preserves real arguments, returns, failures, refs and pending interleavings."
);

let actualProps;
const react19 = {
  type: (props) => {
    actualProps = props;
    props.ref(instance);
    return "real-react19-render";
  },
};
observeCameraDispatch(react19, "setCamera");
const modernRef = { current: null };
assert.equal(
  react19.type({
    ref: modernRef,
    maxBounds: [
      [-20, -20],
      [20, 20],
    ],
  }),
  "real-react19-render"
);
assert.deepEqual(actualProps.maxBounds, [
  [-20, -20],
  [20, 20],
]);
assert.equal(modernRef.current.setCamera(command), undefined);
await Promise.resolve();
assert.equal(state.events.at(-1).phase, "acknowledged");
assert.equal(state.pending.size, 0);
console.log(
  "Camera observer also supports the exact MapLibre memo/ref-prop shape."
);

// Scenario activation observes only its selected camera and restores it on retirement.
for (const engine of ["mapbox", "maplibre"]) {
  for (const scenario of ["tf09", "tf08", "tf03"]) {
    const original = () => null;
    const cameras = {
      mapbox: { render: original },
      maplibre: { type: original },
    };
    const stop = observeAcceptanceCamera(scenario, engine, cameras);
    assert.equal(
      cameras.mapbox.render !== original,
      scenario === "tf09" && engine === "mapbox"
    );
    assert.equal(
      cameras.maplibre.type !== original,
      scenario === "tf09" && engine === "maplibre"
    );
    stop();
    stop();
    assert.equal(cameras.mapbox.render, original);
    assert.equal(cameras.maplibre.type, original);
  }
}
console.log(
  "PASS native scenario camera observer selects one SDK, skips unrelated screens and restores wrapper components on retirement."
);

// Retired async acknowledgments must not pollute the next scenario's observations.
let settle;
const latePromise = new Promise((done) => {
  settle = done;
});
const lateCamera = {
  render: (_props, ref) => {
    ref({ setCamera: () => latePromise });
  },
};
const stopLate = observeAcceptanceCamera("tf09", "mapbox", {
  mapbox: lateCamera,
  maplibre: {},
});
const lateRef = { current: null };
lateCamera.render({}, lateRef);
const acknowledged = lateRef.current.setCamera({ center: [1, 1] });
stopLate();
const retiredEvents = [...state.events];
settle();
await acknowledged;
await Promise.resolve();
assert.deepEqual(state.events, retiredEvents);
const count = state.nextId;
await lateRef.current.setCamera({ center: [2, 2] });
assert.equal(state.nextId, count);
assert.equal(state.pending.size, 0);
console.log(
  "PASS retired camera acknowledgments and stale refs do not enter a replacement scenario's test observations."
);

const cleanupCamera = { render: () => null };
const firstStop = observeCameraDispatch(cleanupCamera, "setCamera");
firstStop();
const secondStop = observeCameraDispatch(cleanupCamera, "setCamera");
const activeRender = cleanupCamera.render;
firstStop();
assert.equal(cleanupCamera.render, activeRender);
secondStop();
console.log(
  "PASS repeated old cleanup cannot remove a new scenario's camera observer."
);

assert.throws(
  () => observeAcceptanceCamera("tf09", "mapbox", {}),
  /Selected acceptance camera is not attached/
);
assert.doesNotThrow(() => observeAcceptanceCamera("tf08", "mapbox", {})());
console.log(
  "PASS only TF09 requires its selected camera; unrelated scenarios need no SDK camera."
);
