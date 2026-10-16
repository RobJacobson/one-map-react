import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const record = JSON.parse(
  readFileSync(
    new URL("records/evidence/example-workspace-checkpoint.json", root),
    "utf8"
  )
);
assert.equal(
  createHash("sha256").update(JSON.stringify(record.sourceFiles)).digest("hex"),
  record.sourceSha256,
  "Checkpoint source identity is inconsistent."
);
assert.equal(
  createHash("sha256").update(JSON.stringify(record.builtFiles)).digest("hex"),
  record.builtSha256,
  "Checkpoint build identity is inconsistent."
);

for (const [filename, expected] of Object.entries(record.sourceFiles)) {
  const actual = createHash("sha256")
    .update(readFileSync(new URL(filename, root)))
    .digest("hex");
  assert.equal(actual, expected, `Frozen checkpoint changed: ${filename}`);
}
for (const [filename, expected] of Object.entries(record.builtFiles)) {
  const actual = createHash("sha256")
    .update(readFileSync(new URL(filename, root)))
    .digest("hex");
  assert.equal(actual, expected, `Frozen build changed: ${filename}`);
}
console.log(
  `PASS example checkpoint ${record.sourceSha256}: source, built exports, and unchanged patch identities.`
);
