import assert from "node:assert/strict";
import { resolve } from "node:path";

import { checkInventory } from "./check-inventory.mjs";
import { compactInventory, expandInventory } from "./inventory-format.mjs";

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
const original = {
  schemaVersion: 1,
  notes: ["preserved"],
  entries: [entry, { ...entry, id: "fixture:second" }],
};
const before = structuredClone(original);
const compact = compactInventory(original);
assert.deepEqual(original, before, "compaction must not mutate its input");
assert.equal(compact.schemaVersion, 2);
assert.equal(Object.keys(compact.supportProfiles).length, 1);
assert.equal(Object.keys(compact.evidenceProfiles).length, 1);
assert.deepEqual(expandInventory(compact), original);
assert.deepEqual(checkInventory(compact, root), []);
assert.deepEqual(compactInventory(expandInventory(compact)), compact);
const compactBefore = structuredClone(compact);
expandInventory(compact);
assert.deepEqual(compact, compactBefore, "expansion must not mutate its input");
const editable = expandInventory(compact);
editable.entries[0].support["mapbox-web"].applicable = false;
editable.entries[0].evidenceReferences.push("another record");
assert.equal(editable.entries[1].support["mapbox-web"].applicable, true);
assert.deepEqual(
  editable.entries[1].evidenceReferences,
  entry.evidenceReferences
);
assert.deepEqual(
  compact,
  compactBefore,
  "editing expanded entries must not mutate the compact input"
);
const editableCompact = compactInventory(original);
editableCompact.supportProfiles[editableCompact.entries[0].supportProfile][
  "mapbox-web"
].applicable = false;
assert.deepEqual(
  original,
  before,
  "editing a compact profile must not mutate the original inventory"
);
const reordered = {
  ...entry,
  support: {
    "mapbox-web": {
      evidence: [],
      tests: [],
      implementation: "implemented",
      applicable: true,
    },
  },
};
assert.equal(
  compactInventory({ entries: [reordered] }).entries[0].supportProfile,
  compact.entries[0].supportProfile
);

for (const [label, change, pattern] of [
  [
    "missing reference",
    { entries: [{ ...compact.entries[0], supportProfile: "missing" }] },
    /missing supportProfile/,
  ],
  [
    "omitted reference",
    { entries: [{ id: "fixture:missing" }] },
    /missing supportProfile/,
  ],
  [
    "missing evidence reference",
    { entries: [{ ...compact.entries[0], evidenceProfile: "missing" }] },
    /missing evidenceProfile/,
  ],
  [
    "ambiguous reference",
    { entries: [{ ...compact.entries[0], support: entry.support }] },
    /ambiguous/,
  ],
  [
    "malformed support",
    { supportProfiles: { invalid: [] } },
    /support profile/,
  ],
  [
    "malformed support cell",
    { supportProfiles: { invalid: { web: null } } },
    /support profile/,
  ],
  [
    "malformed evidence",
    { evidenceProfiles: { invalid: [42] } },
    /evidence profile/,
  ],
  ["missing profiles", { supportProfiles: undefined }, /supportProfiles/],
  ["unknown version", { schemaVersion: 3 }, /schema version/],
]) {
  const invalid = { ...compact, ...change };
  assert.throws(() => expandInventory(invalid), pattern, label);
  assert(
    checkInventory(invalid, root).some((failure) => pattern.test(failure)),
    label
  );
}
assert.throws(
  () =>
    expandInventory({ entries: [{ ...entry, supportProfile: "unexpected" }] }),
  /unexpected/
);
const reversedEvidence = compactInventory({
  entries: [
    { ...entry, evidenceReferences: ["first", "second"] },
    { ...entry, evidenceReferences: ["second", "first"] },
  ],
});
assert.equal(
  Object.keys(reversedEvidence.evidenceProfiles).length,
  2,
  "array order must remain significant"
);
console.log(
  "PASS inventory fixtures: identity, aliases, current targets, pending work and narrow owner exceptions"
);
