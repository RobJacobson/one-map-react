import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** Exact attempt24/25 observations accepted for the unchanged API36 Mapbox unit. */
export const api36ReusedScenarios = [
  "live-child-button",
  "nested-scroll",
  "live-activation",
  "annotation-activation",
  "offset-touch-bounds",
  "popup-follow-dismissal",
  "map-feature-click",
  "navigation-location",
  "style-remount",
  "host-accessibility",
  "sdk-ornaments",
  "camera-target-and-gesture",
];

const attempt =
  "/Users/rob/code/mapbox-code/one-map-f05-android-recovery/android-platform-batch-attempt-24";
const reportPath = `${attempt}/mapbox-android-core-manual.json`;
const reportSha256 =
  "2004a8da2e60faec951575734cd74d1a090cf661b3d6ad0acaa982a70689cf9f";
const outcomeSha256 =
  "ed5eb01cdfe604650117ebeac924add146ae5c6e1bc092964f34b74f88e9065c";

/** Loads pinned historical outcomes without importing historical renderer events. */
export const loadApi36ReusedObservations = (identity, read = readFileSync) => {
  const prior = readPinned(reportPath, reportSha256, read);
  const outcomePath = resolve(
    import.meta.dirname,
    "../records/evidence/revised-api-u26-android-mapbox-api36-attempt-24.json"
  );
  const outcome = readPinned(outcomePath, outcomeSha256, read);
  assert.equal(
    outcome.candidateSha256,
    "33828324898408485cd9211cc780f098d1564d90426887ff9fb4b64733913276"
  );
  assert.equal(outcome.inputApkSha256, identity.installedBinarySha256);
  assert.equal(outcome.result, "stopped-at-popup-attachment-observation");
  for (const field of [
    "installedBinarySha256",
    "libraryDistSha256",
    "environment",
  ])
    assert.equal(prior[field], identity[field], `Reused ${field} differs.`);
  assert.equal(prior.environment, "mapbox-android");
  assert.equal(prior.runId, "54f2120a-9c16-410f-a604-c7d6d37eeb06");
  assert.notEqual(
    prior.runId,
    identity.runId,
    "Resume requires a fresh run identity."
  );
  assert.equal(prior.scenarios["popup-follow-dismissal"], "failed");
  const recentReportPath = reportPath.replace("attempt-24", "attempt-25");
  const recentReportSha256 =
    "7e60ab7f5d2ff03d18ff710a62e91f319657d95612adb0451c29403308cd235d";
  const recentOutcomePath = outcomePath.replace("attempt-24", "attempt-25");
  const recentOutcomeSha256 =
    "62cb048cd886313f3539a98cdfa749e9421e437c459cf02a74a0ebd9c8ea4c21";
  const recentOutcome = readPinned(
    recentOutcomePath,
    recentOutcomeSha256,
    read
  );
  const recent = readPinned(recentReportPath, recentReportSha256, read);
  assert.equal(recentOutcome.candidateSha256, outcome.candidateSha256);
  assert.equal(recentOutcome.inputApkSha256, identity.installedBinarySha256);
  assert.equal(
    recentOutcome.result,
    "stopped-at-marker-rejection-development-error-overlay"
  );
  assert.equal(recent.runId, "41dce16e-6bb1-4454-bae7-34046a870505");
  assert.notEqual(
    recent.runId,
    identity.runId,
    "Resume requires a fresh run identity."
  );
  for (const field of [
    "installedBinarySha256",
    "libraryDistSha256",
    "environment",
  ])
    assert.equal(recent[field], identity[field], `Reused ${field} differs.`);
  assert.equal(recent.scenarios["marker-prop-rejection"], "failed");
  return Object.fromEntries(
    api36ReusedScenarios.map((scenario, index) => {
      const sourceReport = index < 5 ? prior : recent;
      const source =
        index < 5
          ? {
              reportPath,
              reportSha256,
              outcomePath,
              outcomeSha256,
              runId: prior.runId,
            }
          : {
              reportPath: recentReportPath,
              reportSha256: recentReportSha256,
              outcomePath: recentOutcomePath,
              outcomeSha256: recentOutcomeSha256,
              runId: recent.runId,
            };
      assert.equal(sourceReport.scenarios[scenario], "passed");
      assert(sourceReport.observations[scenario]);
      return [
        scenario,
        {
          source: {
            ...source,
            environment: "api36-google-apis-revision7-arm64-4k",
          },
          observation: sourceReport.observations[scenario],
        },
      ];
    })
  );
};

const readPinned = (path, hash, read) => {
  const bytes = read(path);
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    hash,
    `Reused evidence changed: ${path}`
  );
  return JSON.parse(bytes);
};
