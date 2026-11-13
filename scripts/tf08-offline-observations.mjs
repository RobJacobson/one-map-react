import assert from "node:assert/strict";

/** exec-out does not propagate a missing remote file's exit status. */
export const readAndroidAppFile = async (adb, applicationId, path) => {
  await adb(["shell", "run-as", applicationId, "test", "-f", path]);
  return adb(["exec-out", "run-as", applicationId, "cat", path], true);
};

/** A transport deadline or missing bridge does not establish native file validation. */
export const assertMissingDatabaseRejection = (message) => {
  assert(
    !/is not a function|cannot read (?:properties|property) of (?:undefined|null)|timed out|timeout/i.test(
      message
    ),
    `Invalid file-input rejection: ${message}`
  );
};

/** An occupied migration destination must reject without replacing its data. */
export const assertExistingDatabaseRejection = (message, before, after) => {
  assert.match(message, /already exists/i);
  assert(before.length > 0, "Migration destination must contain real data.");
  assert.deepEqual(
    after,
    before,
    "Rejected migration changed the existing database."
  );
};

/** Both SDK log formats describe the same expected database replacement. */
export const unexpectedResetWarnings = (engine, warnings) =>
  warnings.filter(
    (message) =>
      !(
        engine === "maplibre" &&
        message.endsWith("Removing existing incompatible offline database")
      )
  );
