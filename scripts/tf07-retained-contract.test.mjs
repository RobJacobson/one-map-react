import assert from "node:assert/strict";

import {
  judgeNativeDensityMatrix,
  judgeNativeRetained,
  nativeRetainedReportReady,
  nativeRetainedScenarios,
} from "./tf07-retained-contract.mjs";

const identity = {
  installedBinarySha256: "a".repeat(64),
  libraryDistSha256: "b".repeat(64),
  environment: "mapbox-ios",
  runId: "current-retained",
};
const manual = {
  ...identity,
  scenarios: Object.fromEntries(
    nativeRetainedScenarios.map((name) => [name, "passed"])
  ),
};
const map = (name, center) => ({
  center,
  zoom: name === "a" ? 11 : 12,
  bounds: [0, 100, 300, 250],
  point: [120, 120],
  features: [
    {
      id: name === "a" ? 1707 : 2707,
      properties: { fixture: `tf07-focus-${name}` },
    },
  ],
});
const read = (updated = false) => ({
  window: { width: 390, height: 844, scale: 3 },
  theme: updated ? "updated" : "initial",
  short: updated,
  a: map("a", [-122.34, 47.61]),
  b: map("b", [-122.33, 47.615]),
  children: Object.fromEntries(
    ["a", "b"].map((name) => [
      name,
      {
        theme: updated ? "updated" : "initial",
        count: updated ? 2 : 1,
        center: name === "a" ? [-122.34, 47.61] : [-122.33, 47.615],
        zoom: name === "a" ? 11 : 12,
      },
    ])
  ),
  events: {
    "image-load": 1,
    "image-refresh": 1,
    "a-feature-touch": 1,
    "b-feature-touch": 1,
  },
});
const final = read(true);
final.window = { width: 844, height: 390, scale: 3 };
final.a.bounds[3] = 150;
final.a.center = [-122.345, 47.612];
const observation = {
  focusedComplete: true,
  observations: [read(), read(true), final],
};
assert.equal(
  judgeNativeRetained(observation, manual, identity).status,
  "passed"
);
const preliminary = { ...read(), children: {} };
assert.equal(
  judgeNativeRetained(
    {
      ...observation,
      observations: [preliminary, ...observation.observations],
    },
    manual,
    identity
  ).status,
  "passed"
);
assert.equal(
  judgeNativeRetained(
    {
      ...observation,
      observations: [...observation.observations, preliminary],
    },
    manual,
    identity
  ).status,
  "unverified"
);
const failedAfterPreliminary = structuredClone(observation);
failedAfterPreliminary.observations.unshift(preliminary);
failedAfterPreliminary.observations.at(-1).events["read-error"] = 1;
assert.equal(
  judgeNativeRetained(failedAfterPreliminary, manual, identity).status,
  "unverified"
);

for (const field of [
  "installedBinarySha256",
  "libraryDistSha256",
  "environment",
  "runId",
])
  assert.equal(
    judgeNativeRetained(observation, { ...manual, [field]: "stale" }, identity)
      .status,
    "unverified"
  );
for (const scenario of nativeRetainedScenarios) {
  const incomplete = {
    ...manual,
    scenarios: { ...manual.scenarios, [scenario]: "unverified" },
  };
  assert.equal(nativeRetainedReportReady(incomplete, identity), false);
  assert.equal(
    judgeNativeRetained(observation, incomplete, identity).status,
    "unverified"
  );
  assert.equal(
    nativeRetainedReportReady(
      {
        ...incomplete,
        scenarios: { ...incomplete.scenarios, [scenario]: "failed" },
      },
      identity
    ),
    true
  );
}
for (const mutate of [
  (o) => {
    o.focusedComplete = false;
  },
  (o) => {
    o.observations = [];
  },
  (o) => {
    o.observations[1].a.features = [];
  },
  (o) => {
    o.observations[2].a.bounds[2] = 0;
  },
  (o) => {
    o.observations[2].window.scale = 0;
  },
  (o) => {
    o.observations[2].window.width = Infinity;
  },
  (o) => {
    o.observations[2].window.width = 390;
    o.observations[2].window.height = 844;
  },
  (o) => {
    for (const r of o.observations) r.children.b.theme = "initial";
  },
  (o) => {
    o.observations[2].children.a.zoom = 12;
  },
  (o) => {
    o.observations[2].events["image-refresh"] = 0;
  },
  (o) => {
    o.observations[2].events["image-error"] = 1;
  },
  (o) => {
    o.observations[2].events["b-feature-touch"] = 0;
  },
  (o) => {
    for (const r of o.observations) r.a.center = [-122.34, 47.61];
  },
  (o) => {
    o.observations[1].a = {};
  },
]) {
  const copy = structuredClone(observation);
  mutate(copy);
  assert.equal(
    judgeNativeRetained(copy, manual, identity).status,
    "unverified"
  );
}
const results = ["mapbox", "maplibre"].flatMap((engine) => [
  { environment: `${engine}-ios`, density: 3, status: "passed" },
  { environment: `${engine}-android`, density: 2, status: "passed" },
]);
assert(judgeNativeDensityMatrix(results));
assert(
  !judgeNativeDensityMatrix(
    results.map((result) => ({ ...result, density: 3 }))
  )
);
assert(
  !judgeNativeDensityMatrix(
    results.map((result) =>
      result.environment === "mapbox-android"
        ? { ...result, status: "unverified" }
        : result
    )
  )
);
console.log(
  "PASS six retained native receipts require current identity, independent two-map renderer/geometry, provider state, image refresh and physical observations; density matrix requires two actual values per engine."
);
