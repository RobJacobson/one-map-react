import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  packageCheckOptions,
  selectedVersions,
} from "./package-check-options.mjs";

const directory = mkdtempSync(join(tmpdir(), "one-map-package-options-"));
try {
  const file = join(directory, "versions.json");
  const archive = join(directory, "candidate.tgz");
  writeFileSync(file, JSON.stringify({ "@rnmapbox/maps": "10.3.8" }));
  writeFileSync(archive, "fixture");
  assert.deepEqual(packageCheckOptions([]), {
    archive: undefined,
    versions: {},
    evidence: undefined,
  });
  const options = packageCheckOptions([
    "--archive",
    archive,
    "--versions",
    file,
  ]);
  assert.equal(options.archive, archive);
  assert.deepEqual(
    selectedVersions(
      ["react@19.2.3"],
      { default: { react: "19.3.1" }, "mapbox-native": { react: "19.2.3" } },
      "mapbox-native"
    ),
    ["react@19.2.3"]
  );
  assert.deepEqual(
    selectedVersions(
      ["@rnmapbox/maps@10.3.7", "react@19.2.3"],
      options.versions
    ),
    ["@rnmapbox/maps@10.3.8", "react@19.2.3"]
  );
  for (const version of ["^10.3.8", "10.3.9-rc.0", "latest"]) {
    writeFileSync(file, JSON.stringify({ "@rnmapbox/maps": version }));
    assert.throws(
      () => packageCheckOptions(["--versions", file]),
      /exact stable/
    );
  }
  assert.throws(() => packageCheckOptions(["--other", file]), /Unknown/);
  assert.throws(() => packageCheckOptions(["--archive"]), /Missing value/);
  assert.throws(
    () => packageCheckOptions(["--archive", join(directory, "missing")]),
    /Missing/
  );
} finally {
  rmSync(directory, { recursive: true, force: true });
}
console.log(
  "PASS frozen package options: defaults, scoped exact versions and invalid input"
);
