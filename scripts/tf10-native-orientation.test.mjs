import assert from "node:assert/strict";

import { readNativeOrientation } from "../packages/example-map/src/scenarios/tf10-native-orientation.ts";

let calls = 0;
const unavailable = {
  getBearing: async () => {
    calls++;
    throw new Error("getBearing() is not available on mapbox-native.");
  },
  getPitch: async () => {
    calls++;
    throw new Error("getPitch() is not available on mapbox-native.");
  },
};
const actualEvent = {
  longitude: 10,
  latitude: 20,
  zoom: 3,
  bearing: 17,
  pitch: 28,
};
assert.deepEqual(
  await readNativeOrientation("mapbox-native", unavailable, actualEvent),
  {
    bearing: 17,
    pitch: 28,
    orientationSource: "native-camera-event",
  }
);
assert.equal(calls, 0);
await assert.rejects(
  readNativeOrientation("mapbox-native", unavailable, undefined),
  /native camera event is required/
);
await assert.rejects(
  readNativeOrientation("mapbox-native", unavailable, {
    ...actualEvent,
    bearing: NaN,
  }),
  /native camera event is required/
);
assert.equal(calls, 0);
assert.deepEqual(
  await readNativeOrientation(
    "maplibre-native",
    {
      getBearing: async () => {
        calls++;
        return 40;
      },
      getPitch: async () => {
        calls++;
        return 50;
      },
    },
    actualEvent
  ),
  { bearing: 40, pitch: 50, orientationSource: "native-camera-getters" }
);
assert.equal(calls, 2);
console.log(
  "PASS: Mapbox uses actual event orientation without unavailable getters or defaults; MapLibre uses native getters."
);
