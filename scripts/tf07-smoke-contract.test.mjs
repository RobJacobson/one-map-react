import assert from "node:assert/strict";

import {
  judgeNativeUi,
  nativeUiReportReady,
  nativeUiScenarios,
} from "./tf07-smoke-contract.mjs";

const binary = "a".repeat(64);
const identity = {
  installedBinarySha256: binary,
  libraryDistSha256: "c".repeat(64),
  environment: "mapbox-android",
  runId: "current-native-run",
};
const observation = {
  generation: 1,
  center: [-122.33, 47.61],
  zoom: 11,
  events: {
    load: 2,
    "child-click": 1,
    "marker-click": 1,
    "annotation-click": 1,
    "source-click": 2,
    "popup-close": 1,
    location: 1,
  },
  features: [{ id: 707, properties: { fixture: "tf07" } }],
};
const manual = {
  ...identity,
  scenarios: Object.fromEntries(
    nativeUiScenarios.map((name) => [name, "passed"])
  ),
};

assert.equal(nativeUiReportReady(undefined, identity), false);
assert.equal(nativeUiReportReady(manual, identity), true);
assert.equal(
  nativeUiReportReady({ ...manual, runId: "stale" }, identity),
  false
);
for (const outcome of ["unverified", "failed"]) {
  assert.equal(
    nativeUiReportReady(
      {
        ...manual,
        scenarios: { ...manual.scenarios, "style-remount": outcome },
      },
      identity
    ),
    outcome === "failed"
  );
}

assert.equal(
  judgeNativeUi(observation, undefined, identity).status,
  "unverified"
);
assert.equal(judgeNativeUi(observation, manual, identity).status, "passed");
for (const activation of ["marker-click", "annotation-click"]) {
  assert.equal(
    judgeNativeUi(
      { ...observation, events: { ...observation.events, [activation]: 0 } },
      manual,
      identity
    ).status,
    "unverified"
  );
}
assert(!nativeUiScenarios.some((scenario) => scenario.includes("drag")));
for (const id of ["707", 708, "708", "0707"]) {
  assert.equal(
    judgeNativeUi(
      {
        ...observation,
        features: [{ id, properties: { fixture: "tf07" } }],
      },
      manual,
      identity
    ).status,
    id === "707" ? "passed" : "unverified"
  );
}
assert.equal(
  judgeNativeUi(observation, manual, {
    ...identity,
    installedBinarySha256: "b".repeat(64),
  }).status,
  "unverified"
);
assert.equal(
  judgeNativeUi({ ...observation, features: [] }, manual, identity).status,
  "unverified"
);
assert.equal(
  judgeNativeUi(
    { ...observation, events: { ...observation.events, error: 1 } },
    manual,
    identity
  ).status,
  "unverified"
);
assert.equal(
  judgeNativeUi(
    observation,
    {
      ...manual,
      scenarios: { ...manual.scenarios, "nested-scroll": "unverified" },
    },
    identity
  ).status,
  "unverified"
);
for (const invalid of [
  { generation: 0 },
  { center: [NaN, 47.61] },
  { zoom: Infinity },
]) {
  assert.equal(
    judgeNativeUi({ ...observation, ...invalid }, manual, identity).status,
    "unverified"
  );
}
for (const field of ["libraryDistSha256", "environment", "runId"]) {
  assert.equal(
    judgeNativeUi(observation, { ...manual, [field]: "stale" }, identity)
      .status,
    "unverified"
  );
}

console.log(
  "PASS TF07 native judgment requires renderer evidence and build-matched manual observations."
);

const { judgeNativeFocusedUi, nativeFocusedUiScenarios } =
  await import("./tf07-smoke-contract.mjs");
const focused = {
  focused: true,
  focusedComplete: true,
  readSequence: 4,
  aCenter: [-122.34, 47.61],
  bCenter: [-122.34, 47.61],
  aZoom: 11,
  bZoom: 12,
  aViewport: [0, 100, 375, 300],
  bViewport: [0, 400, 375, 200],
  overlap: [{ id: 707 }, { id: "708" }],
  vector: [{ id: 1 }],
  theme: "updated",
  counts: {
    "high-click": 2,
    "a-map-click": 2,
    "vector-click": 1,
    "image-load": 1,
    "image-refresh": 1,
    "provider-call": 3,
    "provider-error": 1,
    "provider-location": 1,
    "Map A-click": 4,
    "Map B-click": 4,
  },
};
const focusedManual = {
  ...identity,
  scenarios: Object.fromEntries(
    nativeFocusedUiScenarios.map((name) => [name, "passed"])
  ),
};
assert.equal(
  judgeNativeFocusedUi(focused, focusedManual, identity).status,
  "passed"
);
for (const invalid of [
  { focusedComplete: false },
  { aViewport: [0, 0, 0, 0] },
  { overlap: [] },
  { vector: [] },
  { readSequence: 0 },
  { bZoom: 14 },
  { theme: "initial" },
  { counts: { ...focused.counts, "provider-location": 0 } },
  { counts: { ...focused.counts, "a-map-click": 1 } },
  { counts: { ...focused.counts, "read-error": 1 } },
])
  assert.equal(
    judgeNativeFocusedUi({ ...focused, ...invalid }, focusedManual, identity)
      .status,
    "unverified"
  );
assert.equal(
  judgeNativeFocusedUi(focused, { ...focusedManual, runId: "stale" }, identity)
    .status,
  "unverified"
);
console.log(
  "PASS focused UI judgment rejects missing physical outcomes, stale identity, invalid geometry, absent source/features, provider failure, and violated zoom limits."
);
