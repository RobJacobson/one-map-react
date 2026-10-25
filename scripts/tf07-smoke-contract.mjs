/** Physical and visual native observations required for a TF07 UI pass. */
export const nativeUiScenarios = [
  "live-child-button",
  "nested-scroll",
  "live-activation",
  "annotation-activation",
  "offset-touch-bounds",
  "popup-follow-dismissal",
  "source-propagation",
  "navigation-location",
  "style-remount",
  "host-accessibility",
  "scale-units",
];

/** A final physical read may finish only after every run-bound outcome is recorded. */
export const nativeUiReportReady = (manual, identity) =>
  ["installedBinarySha256", "libraryDistSha256", "environment", "runId"].every(
    (field) => manual?.[field] === identity[field]
  ) &&
  nativeUiScenarios.every((scenario) =>
    ["passed", "failed"].includes(manual?.scenarios?.[scenario])
  );

/**
 * Checks native observations without treating callback logs as visual proof.
 * @param {object} observation - Readback posted by the actual native fixture.
 * @param {object | undefined} manual - Operator outcomes tied to this build.
 * @param {object} identity - Verified binary, library, environment, and run identity.
 * @returns {object} A pass requires both known-feature readback and manual outcomes.
 */
export const judgeNativeUi = (observation, manual, identity) => {
  const events = observation?.events ?? {};
  // Android GeoJSON bridges stringify ids; leave renderer results untouched.
  const hasFixture = observation?.features?.some(
    (feature) =>
      (feature.id === 707 || feature.id === "707") &&
      feature.properties?.fixture === "tf07"
  );
  const observed =
    hasFixture &&
    observation.generation >= 1 &&
    observation.center?.length === 2 &&
    observation.center.every(Number.isFinite) &&
    Number.isFinite(observation.zoom) &&
    events.load >= 2 &&
    events["child-click"] >= 1 &&
    events["marker-click"] >= 1 &&
    events["annotation-click"] >= 1 &&
    events["source-click"] >= 2 &&
    events["popup-close"] >= 1 &&
    events.location >= 1 &&
    !events.error;
  const manualComplete =
    /^[a-f0-9]{64}$/.test(identity.installedBinarySha256) &&
    /^[a-f0-9]{64}$/.test(identity.libraryDistSha256) &&
    [
      "installedBinarySha256",
      "libraryDistSha256",
      "environment",
      "runId",
    ].every((field) => manual?.[field] === identity[field]) &&
    nativeUiScenarios.every(
      (scenario) => manual?.scenarios?.[scenario] === "passed"
    );

  return {
    status: observed && manualComplete ? "passed" : "unverified",
    execution: "manual-native-touch",
    observed,
    manualComplete,
    remaining: nativeUiScenarios.filter(
      (scenario) => manual?.scenarios?.[scenario] !== "passed"
    ),
  };
};
