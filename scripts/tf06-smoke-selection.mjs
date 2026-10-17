/**
 * Selects native engines so scoped retries can release build outputs between runs.
 *
 * @param {string} scope - TF06 query or lifetime scope.
 * @param {string} selection - Both engines or one lifetime engine.
 * @returns {string[]} The native engines to execute sequentially.
 */
export const selectNativeEngines = (scope, selection = "both") => {
  if (!["both", "mapbox", "maplibre"].includes(selection))
    throw new Error("Use both, mapbox, or maplibre for the native engine.");
  if (scope !== "lifetimes" && selection !== "both")
    throw new Error("Single-engine selection requires the lifetime scope.");
  return selection === "both" ? ["mapbox", "maplibre"] : [selection];
};

/**
 * Restricts lifetime builds/installations to the assigned Android device and ABI.
 *
 * @param {string} scope - Selected TF06 scope.
 * @param {string | undefined} serial - Explicitly assigned Android device.
 * @returns {string[]} React Native build/run arguments.
 */
export const androidSmokeArgs = (scope, serial) => {
  const args = ["run", "android", "--", "--no-packager"];
  if (scope !== "lifetimes") return args;
  if (!serial?.trim())
    throw new Error("Set ANDROID_SERIAL for native lifetime acceptance.");
  return [...args, "--device", serial, "--active-arch-only"];
};

/**
 * Checks a reused native binary against the coordinator's accepted baseline.
 *
 * @param {string} scope - Only the added lifetime scope supports binary reuse.
 * @param {string} expected - Accepted executable SHA-256.
 * @param {string} actual - Installed executable SHA-256.
 * @returns {void} A mismatch rejects before the app is launched.
 */
export const verifyNativeBinary = (scope, expected, actual) => {
  if (scope !== "lifetimes" || !/^[a-f0-9]{64}$/.test(expected))
    throw new Error("Native reuse requires a lifetime baseline SHA-256.");
  if (actual !== expected)
    throw new Error("Installed native executable does not match the baseline.");
};
