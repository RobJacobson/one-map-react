import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
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

  const prior = reportFor(nativeUiScenarios);
  prior.scenarios["live-child-button"] = "passed";
  prior.reusedObservations = {
    "live-child-button": { source: { runId: "prior-run" }, observation },
  };
  reset(prior);
  expectUnchangedFailure(() => record("live-child-button"));
  record("popup-follow-dismissal");
  assert.deepEqual(
    JSON.parse(fs.readFileSync(reportPath)).reusedObservations,
    prior.reusedObservations
  );

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
  // Replay the actual operator input only on a temporary report; no acceptance credit.
  const rejectedInputPath = new URL(
    "./fixtures/api36-maplibre-attempt30-rejected-input.json",
    import.meta.url
  );
  const rawInput = fs.readFileSync(rejectedInputPath);
  const syntheticReport = {
    ...reportFor(nativeUiScenarios),
    installedBinarySha256:
      "c4c0ccf43f9d3b7217f8085827b351f10c5ececfb6a70c603be9f766dd64d131",
    libraryDistSha256:
      "f17855848fccf4aad07d2ebc02738d2bb799778ea0bd12070c448cd857251ab5",
    environment: "maplibre-android",
    scenarios: Object.fromEntries(
      nativeUiScenarios.map((name) => [
        name,
        name === "marker-prop-rejection" ? "unverified" : "passed",
      ])
    ),
  };
  const rawReport = Buffer.from(JSON.stringify(syntheticReport));
  assert.equal(
    createHash("sha256").update(rawInput).digest("hex"),
    "818e84f6b230f04c08756893d4302f684d925ff58516e7ac7cbab1d91f458b93"
  );
  fs.writeFileSync(reportPath, rawReport);
  fs.writeFileSync(observationPath, rawInput);
  const replay = () =>
    spawnSync(
      process.execPath,
      [
        join(import.meta.dirname, "record-native-ui-observation.mjs"),
        reportPath,
        "marker-prop-rejection",
        "passed",
        observationPath,
      ],
      { encoding: "utf8" }
    );
  const rejected = replay();
  assert.equal(rejected.status, 1);
  assert.match(rejected.stderr, /Unknown observation field/);
  assert.deepEqual(fs.readFileSync(reportPath), rawReport);
  const corrected = JSON.parse(
    fs.readFileSync(
      new URL(
        "./fixtures/api36-maplibre-attempt30-corrected-input.json",
        import.meta.url
      )
    )
  );
  assert.deepEqual(
    corrected,
    (() => {
      const value = JSON.parse(rawInput);
      value.rendererData.receipts = value.receipts;
      delete value.receipts;
      return value;
    })()
  );
  fs.writeFileSync(observationPath, JSON.stringify(corrected));
  const accepted = replay();
  assert.equal(accepted.status, 0, accepted.stderr);
  const next = JSON.parse(fs.readFileSync(reportPath));
  const priorIdentity = JSON.parse(rawReport);
  for (const field of [
    "installedBinarySha256",
    "libraryDistSha256",
    "environment",
    "runId",
  ])
    assert.equal(next[field], priorIdentity[field]);
  assert.equal(next.scenarios["marker-prop-rejection"], "passed");
  assert.deepEqual(fs.readFileSync(rejectedInputPath), rawInput);
  console.log("Native UI observation writer filesystem regressions passed.");
} finally {
  fs.rmSync(directory, { recursive: true, force: true });
}
