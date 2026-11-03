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

/** Validates the immutable MapLibre camera pass without re-running its scene. */
export const loadMaplibreApi36Camera = (identity, read = readFileSync) => {
  const outcomePath = resolve(
    import.meta.dirname,
    "../records/evidence/revised-api-u26-android-maplibre-api36-attempt-30.json"
  );
  const outcome = readPinned(
    outcomePath,
    "0fc374a6b7037883c71d6446240d4db1fbb482ac39f59c349a1fafa7a5ec8db6",
    read
  );
  assert.equal(outcome.result, "stopped-at-observation-writer-schema-error");
  assert.equal(
    outcome.candidateSha256,
    "33828324898408485cd9211cc780f098d1564d90426887ff9fb4b64733913276"
  );
  assert.equal(outcome.inputApkSha256, identity.installedBinarySha256);
  assert.equal(outcome.distSha256, identity.libraryDistSha256);
  assert.equal(identity.environment, "maplibre-android");
  assert.equal(outcome.environment, "api36-google-apis-revision7-arm64-4k");
  const checkpointPath =
    "/Users/rob/code/mapbox-code/one-map-f05-android-recovery/android-platform-batch-attempt-30/checkpoint.json";
  const prior = readPinned(
    checkpointPath,
    "441e0a77035ce5f7157e550b63dc38c0d244802965164ec1bc74534836efcecf",
    read
  );
  assert.equal(prior.apkSha256, identity.installedBinarySha256);
  assert.equal(prior.environment, outcome.environment);
  assert.deepEqual(prior.rows, outcome.completedRows);
  assert.deepEqual(
    prior.rows.map(({ rowId, status }) => ({ rowId, status })),
    [{ rowId: "maplibre-android-camera", status: "passed" }]
  );
  for (const phase of [
    "maplibre-android-camera-before",
    "maplibre-android-camera-after",
  ]) {
    const reads = prior.identityReads.filter((entry) => entry.phase === phase);
    assert.equal(reads.length, 1);
    assert.equal(reads[0].sha256, identity.installedBinarySha256);
  }
  return {
    row: prior.rows[0],
    outcomePath,
    outcomeSha256:
      "0fc374a6b7037883c71d6446240d4db1fbb482ac39f59c349a1fafa7a5ec8db6",
  };
};

/** Reuses only the twelve recorded physical observations, never old event counters. */
export const loadMaplibreApi36ReusedObservations = (
  identity,
  read = readFileSync
) => {
  const camera = loadMaplibreApi36Camera(identity, read);
  const reportPath =
    "/Users/rob/code/mapbox-code/one-map-f05-android-recovery/android-platform-batch-attempt-30/maplibre-android-core-manual.json";
  const reportSha256 =
    "0b3c5b46c960edc3fa129996bbc794d104c211f1230134af57248d1b263915d1";
  const prior = readPinned(reportPath, reportSha256, read);
  for (const field of [
    "installedBinarySha256",
    "libraryDistSha256",
    "environment",
  ])
    assert.equal(prior[field], identity[field], `Reused ${field} differs.`);
  assert.equal(prior.runId, "8ca84053-4355-45bc-8d81-0b213cd34adb");
  assert.notEqual(
    prior.runId,
    identity.runId,
    "Resume requires a fresh run identity."
  );
  assert.equal(prior.scenarios["marker-prop-rejection"], "unverified");
  return Object.fromEntries(
    api36ReusedScenarios.map((scenario) => {
      assert.equal(prior.scenarios[scenario], "passed");
      assert(
        prior.observations[scenario]?.action &&
          prior.observations[scenario]?.seenResult
      );
      return [
        scenario,
        {
          source: {
            reportPath,
            reportSha256,
            outcomePath: camera.outcomePath,
            outcomeSha256: camera.outcomeSha256,
            runId: prior.runId,
            environment: "api36-google-apis-revision7-arm64-4k",
          },
          observation: prior.observations[scenario],
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
