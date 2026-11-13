import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";

import { assertExistingDatabaseRejection } from "./tf08-offline-observations.mjs";
import { pendingOfflineOperations } from "./tf08-pending-operations.mjs";

assert.deepEqual(pendingOfflineOperations("mapbox"), [
  "ambient-clear",
  "tile-limit",
  "throttle",
  "quota",
  "migrate",
  "legacy-list",
  "legacy-migrate",
  "legacy-limit",
  "legacy-reset",
]);
assert.deepEqual(pendingOfflineOperations("maplibre"), [
  "ambient-invalidate",
  "ambient-clear",
  "ambient-size",
  "tile-limit",
  "throttle",
]);

const smokeScript = readFileSync("scripts/tf08-services-smoke.mjs", "utf8");
console.log("TF08 selected pending-operation lists passed.");

const pendingStart = smokeScript.indexOf(
  "const pendingNativeScenarios = async"
);
const pendingEnd = smokeScript.indexOf(
  "\nconst pendingMergeScenario =",
  pendingStart
);
assert(pendingStart >= 0 && pendingEnd > pendingStart);
for (const operation of ["migrate", "legacy-migrate"]) {
  for (const sourceExisted of [false, true]) {
    for (const fault of [
      undefined,
      "resolved",
      "destination-changed",
      "source-changed",
    ]) {
      const applicationId = "org.onemap.acceptance.fixture";
      const container = "/owned-test-container";
      const destination = join(
        container,
        "Library/Application Support/.mapbox/map_data/map_data.db"
      );
      const sourcePath = join(
        container,
        `Library/Application Support/${operation === "legacy-migrate" ? applicationId : "com.mapbox.examples"}/.mapbox/cache.db`
      );
      const before = Buffer.from("populated synthetic database bytes");
      const files = new Map([[destination, Buffer.from(before)]]);
      const sourceBytes = sourceExisted
        ? Buffer.from("existing source has different database bytes")
        : before;
      if (sourceExisted) files.set(sourcePath, Buffer.from(sourceBytes));
      const receipts = [];
      const outcomes = [];
      const run = runInNewContext(
        `${smokeScript.slice(pendingStart, pendingEnd)}; pendingNativeScenarios;`,
        {
          assert,
          createHash,
          assertExistingDatabaseRejection,
          scope: "pending-operations",
          platform: "ios",
          engine: "mapbox",
          simulator: "owned-simulator",
          applicationId,
          join,
          pendingOfflineOperations: () => [operation],
          currentMapFileScenario: async () => {},
          pendingMergeScenario: async () => {},
          pendingResetScenario: async () => {},
          scenario: async (name, action) => {
            if (name !== `named offline ${operation}`) return;
            try {
              outcomes.push({ status: "passed", value: await action() });
            } catch (error) {
              outcomes.push({ status: "failed", error: String(error) });
            }
          },
          command: async (file, args) => {
            assert.equal(file, "xcrun");
            assert.deepEqual(Array.from(args), [
              "simctl",
              "get_app_container",
              "owned-simulator",
              applicationId,
              "data",
            ]);
            return container;
          },
          existsSync: (path) => files.has(path),
          readFileSync: (path) => {
            assert(files.has(path), `Expected owned fixture file: ${path}`);
            return Buffer.from(files.get(path));
          },
          mkdirSync: () => {},
          writeFileSync: (path, bytes, options) => {
            assert.equal(path, sourcePath);
            assert.equal(options.flag, "wx");
            assert(!files.has(path));
            files.set(path, Buffer.from(bytes));
          },
          rmSync: (path) => {
            assert.equal(path, sourcePath);
            receipts.push("source-cleanup");
            files.delete(path);
          },
          action: async (name, value) => {
            assert.equal(name, "named-offline");
            assert.equal(value.operation, operation);
            assert.deepEqual(files.get(sourcePath), sourceBytes);
            receipts.push(operation);
            if (fault === "resolved") return { warnings: [] };
            if (fault === "destination-changed")
              files.set(destination, Buffer.from("overwritten"));
            if (fault === "source-changed")
              files.set(sourcePath, Buffer.from("corrupted source"));
            throw new Error("The file already exists.");
          },
        }
      );
      await run();
      assert.equal(outcomes.length, 1);
      assert.deepEqual(
        receipts,
        sourceExisted ? [operation] : [operation, "source-cleanup"]
      );
      assert.equal(
        files.has(sourcePath),
        sourceExisted,
        "Cleanup must never delete a preexisting database."
      );
      if (fault)
        assert.equal(outcomes[0].status, "failed", `Must reject ${fault}`);
      else {
        assert.equal(outcomes[0].status, "passed", outcomes[0].error);
        assert.deepEqual(files.get(destination), before);
        if (sourceExisted) assert.deepEqual(files.get(sourcePath), sourceBytes);
        assert.equal(
          outcomes[0].value.expectedRejection,
          "The file already exists."
        );
        assert.equal(outcomes[0].value.existingDestinationPreserved, true);
        assert.equal(outcomes[0].value.sourcePreserved, true);
        assert.equal(outcomes[0].value.bytes, before.length);
        assert.equal(
          outcomes[0].value.databaseSha256,
          createHash("sha256").update(before).digest("hex")
        );
      }
    }
  }
}
console.log(
  "PASS both iOS migration managers verify occupied-destination rejection and preserved source/destination bytes, clean only their synthetic source, and reject unexpected success or destructive changes."
);
