import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { nativeRetainedScenarios } from "./tf07-retained-contract.mjs";
import { nativeUiScenarios } from "./tf07-smoke-contract.mjs";

/**
 * Atomically records one observed outcome without changing the driver's identity.
 *
 * @param reportPath - Existing valid driver-created report.
 * @param scenario - One existing core or retained scenario.
 * @param status - Passed or failed physical observation.
 * @param observationPath - JSON file describing action and seenResult.
 */
export const recordNativeUiObservation = (
  reportPath,
  scenario,
  status,
  observationPath
) => {
  assert(["passed", "failed"].includes(status), "Use passed or failed.");
  const observation = JSON.parse(fs.readFileSync(observationPath, "utf8"));
  validateObservation(observation);
  const original = fs.readFileSync(reportPath, "utf8");
  const report = JSON.parse(original);
  validateReport(report);
  assert(Object.hasOwn(report.scenarios, scenario), "Unknown scenario.");
  assert(
    report.scenarios[scenario] !== "failed" || status === "failed",
    "A failed observation cannot be upgraded."
  );

  const next = {
    ...report,
    scenarios: { ...report.scenarios, [scenario]: status },
    observations: { ...report.observations, [scenario]: observation },
  };
  validateReport(next);
  const temporary = join(
    dirname(reportPath),
    `.${basename(reportPath)}.${randomUUID()}.tmp`
  );
  let ownsTemporary = false;
  try {
    const descriptor = fs.openSync(temporary, "wx");
    ownsTemporary = true;
    try {
      fs.writeFileSync(descriptor, `${JSON.stringify(next, null, 2)}\n`);
    } catch (error) {
      try {
        fs.closeSync(descriptor);
      } catch {
        // Keep the original write failure when closing also fails.
      }
      throw error;
    }
    fs.closeSync(descriptor);
    const written = JSON.parse(fs.readFileSync(temporary, "utf8"));
    validateReport(written);
    assert.deepEqual(written, next, "Written report differs from observation.");
    assert.equal(
      fs.readFileSync(reportPath, "utf8"),
      original,
      "Live report changed; stop instead of overwriting another observation."
    );
    fs.renameSync(temporary, reportPath);
  } catch (error) {
    if (ownsTemporary) {
      try {
        fs.unlinkSync(temporary);
      } catch {
        // Preserve the publication error even if temporary cleanup also fails.
      }
    }
    throw error;
  }
};

const isObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const validateObservation = (observation) => {
  assert(isObject(observation), "Observation must be an object.");
  assert(
    Object.keys(observation).every((field) =>
      ["action", "seenResult", "rendererData", "screenshot"].includes(field)
    ),
    "Unknown observation field."
  );
  for (const field of ["action", "seenResult"]) {
    assert(
      typeof observation[field] === "string" && observation[field].trim(),
      `Observation requires ${field}.`
    );
  }
  if (Object.hasOwn(observation, "rendererData")) {
    assert(
      isObject(observation.rendererData),
      "rendererData must be an object."
    );
  }
  if (Object.hasOwn(observation, "screenshot")) {
    assert(
      typeof observation.screenshot === "string" &&
        observation.screenshot.trim(),
      "screenshot must be a nonempty path."
    );
  }
};

const validateReport = (report) => {
  assert(isObject(report), "Report must be an object.");
  for (const field of ["installedBinarySha256", "libraryDistSha256"]) {
    assert(
      typeof report[field] === "string" && /^[a-f0-9]{64}$/.test(report[field]),
      `Invalid report ${field}.`
    );
  }
  assert(
    /^(mapbox|maplibre)-(android|ios)$/.test(report.environment),
    "Invalid report environment."
  );
  assert(
    typeof report.runId === "string" &&
      /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(report.runId),
    "Invalid report runId."
  );
  assert(isObject(report.scenarios), "Missing report scenarios.");
  const names = Object.keys(report.scenarios).sort();
  assert(
    [nativeUiScenarios, nativeRetainedScenarios].some(
      (known) => JSON.stringify([...known].sort()) === JSON.stringify(names)
    ),
    "Report must contain exactly the core or retained scenarios."
  );
  for (const outcome of Object.values(report.scenarios)) {
    assert(
      ["unverified", "passed", "failed"].includes(outcome),
      "Invalid outcome."
    );
  }
  if (Object.hasOwn(report, "observations")) {
    assert(isObject(report.observations), "Invalid observations.");
    for (const [name, observation] of Object.entries(report.observations)) {
      assert(
        Object.hasOwn(report.scenarios, name),
        "Unknown observation scenario."
      );
      validateObservation(observation);
    }
  }
};

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  assert.equal(
    process.argv.length,
    6,
    "Use REPORT_PATH SCENARIO passed|failed OBSERVATION_JSON_FILE."
  );
  recordNativeUiObservation(...process.argv.slice(2));
}
