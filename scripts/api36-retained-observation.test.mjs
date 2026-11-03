import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { judgeNativeRetained } from "./tf07-retained-contract.mjs";

const fixture = JSON.parse(
  readFileSync(
    new URL("./fixtures/api36-retained-attempt28.json", import.meta.url)
  )
);
const saved = { ...fixture.identity, observation: fixture.observation };
const manual = fixture.manual;
const result = judgeNativeRetained(saved.observation, manual, saved);
assert.equal(result.status, "unverified");
assert.equal(result.manualComplete, true);
assert.equal(result.checks.initialTheme, false);
assert.equal(result.checks.updatedTheme, true);
assert.equal(result.checks.currentRead, false);

// Synthetic controls isolate the two missing observations; they earn no acceptance.
const refreshed = structuredClone(saved.observation);
for (const name of ["a", "b"]) {
  const current = refreshed.observations.at(-1);
  current.children[name].center = current[name].center;
  current.children[name].zoom = current[name].zoom;
}
const freshResult = judgeNativeRetained(refreshed, manual, saved);
assert.equal(freshResult.checks.currentRead, true);
assert.equal(freshResult.checks.initialTheme, false);
assert.equal(freshResult.status, "unverified");
const initial = structuredClone(refreshed.observations[2]);
for (const name of ["a", "b"]) {
  initial.children[name].theme = "initial";
  initial.children[name].count = 1;
}
refreshed.observations.unshift(initial);
assert.equal(judgeNativeRetained(refreshed, manual, saved).status, "passed");
refreshed.observations.at(-1).events["read-error"] = 1;
assert.equal(
  judgeNativeRetained(refreshed, manual, saved).status,
  "unverified"
);
console.log(
  "Saved retained payload exposes missing initial context and stale final children; synthetic controls preserve both gates."
);

// Run the exact packet command against the operator stdout envelope, without Android.
for (const [engine, packetName] of [
  ["mapbox", "revised-api-u26-mapbox-android-api36-retained-preparation.json"],
  ["maplibre", "revised-api-u26-maplibre-android-api36-preparation.json"],
  [
    "maplibre",
    "revised-api-u26-maplibre-android-api36-resume-preparation.json",
  ],
  [
    "maplibre",
    "revised-api-u26-maplibre-android-api36-retained-preparation.json",
  ],
]) {
  const packet = JSON.parse(
    readFileSync(new URL(`../records/evidence/${packetName}`, import.meta.url))
  );
  const temporary = mkdtempSync(join(tmpdir(), "retained-live-judge-"));
  try {
    const statusPath = join(temporary, "status.txt");
    const manualPath = join(temporary, "manual.json");
    const selectedIdentity = {
      ...saved,
      installedBinarySha256: packet.verifiedBinaries.android[engine].sha256,
      environment: `${engine}-android`,
    };
    const selectedManual = {
      ...manual,
      installedBinarySha256: selectedIdentity.installedBinarySha256,
      environment: selectedIdentity.environment,
    };
    writeFileSync(manualPath, JSON.stringify(selectedManual));
    const command = packet.liveJudgeCommand
      .replace(`${packet.output}/retained-status.txt`, statusPath)
      .replace(
        `${packet.output}/${engine}-android-retained-manual.json`,
        manualPath
      );
    const invoke = (body, ending = "COMPLETE 0") => {
      writeFileSync(
        statusPath,
        `WAIT row readiness ${engine}-android-retained\nSTART status http://127.0.0.1:8797/tf07\n${JSON.stringify(body)}\n${ending}\n`
      );
      return spawnSync("/bin/sh", ["-c", command], { encoding: "utf8" });
    };
    const live = invoke(saved.observation);
    assert.equal(live.status, 0, live.stderr);
    assert.deepEqual(
      JSON.parse(live.stdout),
      judgeNativeRetained(saved.observation, selectedManual, selectedIdentity)
    );
    const beforeFinish = structuredClone(refreshed);
    delete beforeFinish.observations.at(-1).events["read-error"];
    beforeFinish.focusedComplete = false;
    const pendingFinish = invoke(beforeFinish);
    assert.equal(pendingFinish.status, 0, pendingFinish.stderr);
    const pendingResult = JSON.parse(pendingFinish.stdout);
    assert.equal(pendingResult.manualComplete, true);
    assert.equal(pendingResult.checks.focusedComplete, false);
    assert(
      Object.entries(pendingResult.checks).every(
        ([name, passed]) => name === "focusedComplete" || passed
      )
    );
    assert.notEqual(invoke(null).status, 0);
    assert.notEqual(invoke(saved.observation, "FAILED status").status, 0);
    writeFileSync(
      manualPath,
      JSON.stringify({
        ...selectedManual,
        installedBinarySha256: "a".repeat(64),
      })
    );
    const tampered = invoke(saved.observation);
    assert.equal(tampered.status, 0, tampered.stderr);
    assert.equal(JSON.parse(tampered.stdout).manualComplete, false);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}
console.log(
  "Both exact packet live judges parses operator START/JSON/COMPLETE output and rejects null, failure and identity mismatch."
);
