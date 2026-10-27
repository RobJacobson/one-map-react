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

for (const scenario of ["camera-target-and-gesture", "marker-prop-rejection"]) {
  assert(nativeUiScenarios.includes(scenario));
  const old = { ...manual, scenarios: { ...manual.scenarios } };
  delete old.scenarios[scenario];
  assert.equal(nativeUiReportReady(old, identity), false);
  assert.equal(judgeNativeUi(observation, old, identity).status, "unverified");
}

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
