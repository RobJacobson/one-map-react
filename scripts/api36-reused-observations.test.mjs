import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  api36ReusedScenarios,
  loadApi36ReusedObservations,
} from "./api36-reused-observations.mjs";
import { judgeNativeUi, nativeUiScenarios } from "./tf07-smoke-contract.mjs";

const identity = {
  installedBinarySha256:
    "ee603d8083769791ce2b9a53a5595a1fa1f5ed6ac4b5705c0010906e49c73eb5",
  libraryDistSha256:
    "f17855848fccf4aad07d2ebc02738d2bb799778ea0bd12070c448cd857251ab5",
  environment: "mapbox-android",
  runId: "94aa0aae-c070-41b6-9eb1-94b467cc9704",
};
const reused = loadApi36ReusedObservations(identity);
assert.deepEqual(Object.keys(reused), api36ReusedScenarios);
assert(!Object.hasOwn(reused, "popup-follow-dismissal"));
for (const entry of Object.values(reused)) {
  assert.equal(entry.source.runId, "54f2120a-9c16-410f-a604-c7d6d37eeb06");
  assert.notEqual(entry.source.runId, identity.runId);
  assert(entry.observation.action);
}
for (const field of [
  "installedBinarySha256",
  "libraryDistSha256",
  "environment",
  "runId",
])
  assert.throws(() =>
    loadApi36ReusedObservations({
      ...identity,
      [field]:
        field === "runId"
          ? reused[api36ReusedScenarios[0]].source.runId
          : "wrong",
    })
  );
for (const suffix of ["manual.json", "attempt-24.json"])
  assert.throws(
    () =>
      loadApi36ReusedObservations(identity, (path) =>
        path.endsWith(suffix) ? Buffer.from("changed") : readFileSync(path)
      ),
    /evidence changed/
  );

const manual = {
  ...identity,
  reusedObservations: reused,
  scenarios: Object.fromEntries(
    nativeUiScenarios.map((name) => [name, "passed"])
  ),
};
const observation = {
  generation: 1,
  center: [-122.34, 47.61],
  zoom: 10,
  features: [{ id: 707, properties: { fixture: "tf07" } }],
  events: { load: 2, "source-click": 2, "popup-close": 1, location: 1 },
};
assert.equal(judgeNativeUi(observation, manual, identity).status, "unverified");
assert.equal(
  judgeNativeUi(observation, manual, identity, Object.keys(reused)).status,
  "passed"
);
assert(
  !Object.hasOwn(observation.events, "child-click"),
  "Do not import historical counters."
);
for (const field of ["load", "source-click", "popup-close", "location"])
  assert.equal(
    judgeNativeUi(
      { ...observation, events: { ...observation.events, [field]: 0 } },
      manual,
      identity,
      Object.keys(reused)
    ).status,
    "unverified"
  );
for (const name of nativeUiScenarios.filter(
  (name) => !api36ReusedScenarios.includes(name)
))
  assert.equal(
    judgeNativeUi(
      observation,
      { ...manual, scenarios: { ...manual.scenarios, [name]: "unverified" } },
      identity,
      Object.keys(reused)
    ).status,
    "unverified"
  );
console.log(
  "Pinned API36 prior evidence, fresh identity, remaining requirements and distinct historical observations passed."
);
