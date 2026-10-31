import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { recordNativeUiObservation } from "./record-native-ui-observation.mjs";
import { nativeRetainedScenarios } from "./tf07-retained-contract.mjs";
import { nativeUiScenarios } from "./tf07-smoke-contract.mjs";

const directory = fs.mkdtempSync(join(tmpdir(), "native-ui-writer-"));
const reportPath = join(directory, "report.json");
const observationPath = join(directory, "observation.json");
const observation = {
  action: "Tap live child inside its visible bounds",
  seenResult: "Child activation appeared while the app stayed foregrounded",
  rendererData: { events: { "child-click": 1 } },
  screenshot: "/temporary/child.png",
};
const reportFor = (scenarios) => ({
  installedBinarySha256: "a".repeat(64),
  libraryDistSha256: "b".repeat(64),
  environment: "mapbox-android",
  runId: "12345678-1234-4234-8234-123456789012",
  scenarios: Object.fromEntries(scenarios.map((name) => [name, "unverified"])),
  metadata: { keep: "driver-owned" },
});
const reset = (report = reportFor(nativeUiScenarios)) => {
  fs.writeFileSync(reportPath, JSON.stringify(report));
  fs.writeFileSync(observationPath, JSON.stringify(observation));
};
const record = (scenario = nativeUiScenarios[0], status = "passed") =>
  recordNativeUiObservation(reportPath, scenario, status, observationPath);
const expectUnchangedFailure = (action) => {
  const before = fs.readFileSync(reportPath);
  assert.throws(action);
  assert.deepEqual(fs.readFileSync(reportPath), before);
  assert.deepEqual(fs.readdirSync(directory).sort(), [
    "observation.json",
    "report.json",
  ]);
};

try {
  // Reproduce the operator's literal backslash+n suffix before testing the repair.
  const broken = `${JSON.stringify(reportFor(nativeUiScenarios), null, 2)}\\n`;
  assert.equal(broken.slice(-2), "\\n");
  assert.throws(() => JSON.parse(broken), SyntaxError);
  reset();
  fs.writeFileSync(reportPath, broken);
  expectUnchangedFailure(() => record());

  for (const scenarios of [nativeUiScenarios, nativeRetainedScenarios]) {
    for (const status of ["passed", "failed"]) {
      const before = reportFor(scenarios);
      reset(before);
      record(scenarios[0], status);
      const bytes = fs.readFileSync(reportPath, "utf8");
      assert(bytes.endsWith("\n") && !bytes.endsWith("\\n"));
      assert.deepEqual(JSON.parse(bytes), {
        ...before,
        scenarios: { ...before.scenarios, [scenarios[0]]: status },
        observations: { [scenarios[0]]: observation },
      });
    }
  }

  reset();
  record(undefined, "failed");
  expectUnchangedFailure(() => record());
  for (const status of ["unverified", "pass", "", undefined]) {
    reset();
    expectUnchangedFailure(() =>
      recordNativeUiObservation(
        reportPath,
        nativeUiScenarios[0],
        status,
        observationPath
      )
    );
  }
  reset();
  expectUnchangedFailure(() => record("unknown"));
  for (const invalid of [
    "{}\\n",
    "{",
    "[]",
    '{"action":"tap","seenResult":""}',
    '{"action":"tap","seenResult":"yes","runId":"replacement"}',
  ]) {
    reset();
    fs.writeFileSync(observationPath, invalid);
    expectUnchangedFailure(() => record());
  }
  for (const mutate of [
    (report) => {
      report.scenarios.unknown = "unverified";
    },
    (report) => {
      report.scenarios[nativeUiScenarios[0]] = "yes";
    },
    (report) => {
      report.runId = "";
    },
    (report) => {
      report.installedBinarySha256 = "wrong";
    },
  ]) {
    const report = reportFor(nativeUiScenarios);
    mutate(report);
    reset(report);
    expectUnchangedFailure(() => record());
  }

  for (const operation of ["writeFileSync", "renameSync"]) {
    reset();
    const original = fs[operation];
    fs[operation] = () => {
      throw new Error(`injected ${operation} failure`);
    };
    try {
      expectUnchangedFailure(() => record());
    } finally {
      fs[operation] = original;
    }
  }
  reset();
  const originalWrite = fs.writeFileSync;
  fs.writeFileSync = (file, bytes, ...args) =>
    originalWrite(file, `${bytes}\\n`, ...args);
  try {
    expectUnchangedFailure(() => record());
  } finally {
    fs.writeFileSync = originalWrite;
  }

  reset();
  const originalRename = fs.renameSync;
  let attemptedRename = false;
  const originalRead = fs.readFileSync;
  let reads = 0;
  fs.readFileSync = (file, ...args) => {
    if (file === reportPath && ++reads === 2) {
      originalWrite(
        reportPath,
        JSON.stringify({
          ...reportFor(nativeUiScenarios),
          metadata: "another worker",
        })
      );
    }
    return originalRead(file, ...args);
  };
  fs.renameSync = (...args) => {
    attemptedRename = true;
    return originalRename(...args);
  };
  try {
    assert.throws(() => record(), /Live report changed/);
    assert.equal(attemptedRename, false);
    assert.equal(
      JSON.parse(originalRead(reportPath)).metadata,
      "another worker"
    );
    assert.equal(fs.readdirSync(directory).length, 2);
  } finally {
    fs.readFileSync = originalRead;
    fs.renameSync = originalRename;
  }

  reset();
  const cli = spawnSync(
    process.execPath,
    [
      join(import.meta.dirname, "record-native-ui-observation.mjs"),
      reportPath,
      nativeUiScenarios[0],
      "passed",
      observationPath,
    ],
    { encoding: "utf8" }
  );
  assert.equal(cli.status, 0, cli.stderr);
  assert.equal(
    JSON.parse(fs.readFileSync(reportPath)).scenarios[nativeUiScenarios[0]],
    "passed"
  );
  console.log("Native UI observation writer filesystem regressions passed.");
} finally {
  fs.rmSync(directory, { recursive: true, force: true });
}
