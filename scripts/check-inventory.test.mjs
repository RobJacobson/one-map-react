import assert from "node:assert/strict";
import { resolve } from "node:path";

import { checkInventory } from "./check-inventory.mjs";

const root = resolve(import.meta.dirname, "..");
const entry = {
  id: "fixture:public-operation",
  implementation: "implemented",
  implementationScope: "scripts/check-inventory.mjs",
  testReferences: ["scripts/check-inventory.test.mjs"],
  evidenceReferences: ["records/evidence/tf09-coverage.json"],
  support: {
    "mapbox-web": {
      applicable: true,
      implementation: "implemented",
      tests: [],
      evidence: [],
    },
  },
};
const check = (entries) => checkInventory({ entries }, root);
assert.deepEqual(check([entry]), []);
assert.deepEqual(
  check([
    {
      ...entry,
      implementationScope:
        "Current owning source: scripts/check-inventory.mjs. Source-backed audit.",
    },
  ]),
  []
);
assert.deepEqual(
  check([entry, { ...entry, id: "fixture:alias", canonicalId: entry.id }]),
  []
);
assert(
  check([entry, entry]).some((failure) => failure.includes("duplicate ID"))
);
assert(
  check([{ ...entry, canonicalId: "missing" }]).some((failure) =>
    failure.includes("unresolved canonical")
  )
);
assert(
  check([
    { ...entry, canonicalId: "fixture:alias" },
    { ...entry, id: "fixture:alias", canonicalId: entry.id },
  ]).some((failure) => failure.includes("cyclic"))
);
for (const field of [
  "implementationScope",
  "testReferences",
  "evidenceReferences",
]) {
  const missing =
    field === "implementationScope"
      ? "packages/missing.ts"
      : ["packages/missing.ts"];
  assert(
    check([{ ...entry, [field]: missing }]).some((failure) =>
      failure.includes("missing current")
    )
  );
}
assert(
  check([{ ...entry, implementation: "pending" }]).some((failure) =>
    failure.includes("unresolved applicable")
  )
);
assert(
  check([
    { ...entry, implementation: "pending", rationale: "deferred by someone" },
  ]).some((failure) => failure.includes("without owner exception"))
);
const excluded = {
  ...entry,
  id: "rnmapbox:rnmapbox.offlineManager.OfflineManager.invalidateAmbientCache",
  implementation: "pending",
  rationale: "Owner exclusion in docs/requirements.md#purpose-and-scope",
};
assert.deepEqual(check([excluded]), []);
assert.deepEqual(
  check([
    {
      ...entry,
      testReferences: ["historical:retired.test.ts", ...entry.testReferences],
    },
  ]),
  []
);
assert(
  check([{ ...entry, testReferences: ["historical:retired.test.ts"] }]).some(
    (failure) => failure.includes("missing current test")
  )
);
assert(
  check([
    {
      ...entry,
      support: {
        web: {
          applicable: true,
          implementation: "implemented",
          tests: ["../../package.json"],
          evidence: [],
        },
      },
    },
  ]).some((failure) => failure.includes("support target"))
);
console.log(
  "PASS inventory fixtures: identity, aliases, current targets, pending work and narrow owner exceptions"
);
