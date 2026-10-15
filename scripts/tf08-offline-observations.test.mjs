import assert from "node:assert/strict";

import {
  assertMissingDatabaseRejection,
  readAndroidAppFile,
  unexpectedResetWarnings,
} from "./tf08-offline-observations.mjs";

let binaryReads = 0;
await assert.rejects(
  readAndroidAppFile(
    async (args) => {
      if (args[0] === "shell") throw new Error("Remote file is absent.");
      binaryReads += 1;
      return Buffer.from("cat: No such file or directory");
    },
    "dedicated.app",
    "files/missing.db"
  ),
  /Remote file is absent/
);
assert.equal(binaryReads, 0);
const databaseBytes = Buffer.from([0, 255, 1, 10]);
assert.deepEqual(
  await readAndroidAppFile(
    async (args, binary) => {
      if (args[0] === "shell") return "";
      assert.equal(binary, true);
      return databaseBytes;
    },
    "dedicated.app",
    "files/present.db"
  ),
  databaseBytes
);

for (const message of [
  "undefined is not a function",
  "Named offline operation timed out.",
  "TF08 observation timed out: required observation.",
])
  assert.throws(() => assertMissingDatabaseRejection(message));
assert.doesNotThrow(() =>
  assertMissingDatabaseRejection("File not found. UserInfo=(null)")
);

const warnings = [
  "MapLibre Native [WARN] [Mbgl] {DatabaseFileSou}[Database]: Removing existing incompatible offline database",
  "MapLibre Native [WARN] [event]:Database [code]:-1 [message]:Removing existing incompatible offline database",
];
assert.deepEqual(unexpectedResetWarnings("maplibre", warnings), []);
assert.deepEqual(unexpectedResetWarnings("mapbox", warnings), warnings);
assert.deepEqual(unexpectedResetWarnings("maplibre", ["Not implemented"]), [
  "Not implemented",
]);
console.log("TF08 offline observation checks passed.");
