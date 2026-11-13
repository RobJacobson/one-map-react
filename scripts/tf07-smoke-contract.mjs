/** Physical and visual native observations required for a TF07 UI pass. */
export const nativeUiScenarios = [
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
  "marker-prop-rejection",
];

/** A final physical read may finish only after every run-bound outcome is recorded. */
export const nativeUiReportReady = (
  manual,
  identity,
  scenarios = nativeUiScenarios
) =>
  ["installedBinarySha256", "libraryDistSha256", "environment", "runId"].every(
    (field) => manual?.[field] === identity[field]
  ) &&
  scenarios.every((scenario) =>
    ["passed", "failed"].includes(manual?.scenarios?.[scenario])
  );

/**
 * Checks native observations without treating callback logs as visual proof.
 * @param {object} observation - Readback posted by the actual native fixture.
 * @param {object | undefined} manual - Operator outcomes tied to this build.
 * @param {object} identity - Verified binary, library, environment, and run identity.
 * @param {string[]} reusedScenarios - Exact prior scenarios validated by the driver; never renderer events from the current run.
 * @returns {object} A pass requires both known-feature readback and manual outcomes.
 */
export const judgeNativeUi = (
  observation,
  manual,
  identity,
  reusedScenarios = []
) => {
  const events = observation?.events ?? {};
  // Android GeoJSON bridges stringify ids; leave renderer results untouched.
  const hasFixture = observation?.features?.some(
    (feature) =>
      (feature.id === 707 || feature.id === "707") &&
      feature.properties?.fixture === "tf07"
  );
  const observed =
    hasFixture &&
    observation.generation >=
      (reusedScenarios.includes("style-remount") ? 0 : 1) &&
    observation.center?.length === 2 &&
    observation.center.every(Number.isFinite) &&
    Number.isFinite(observation.zoom) &&
    events.load >= (reusedScenarios.includes("style-remount") ? 1 : 2) &&
    (events["child-click"] >= 1 ||
      reusedScenarios.includes("live-child-button")) &&
    (events["marker-click"] >= 1 ||
      reusedScenarios.includes("live-activation")) &&
    (events["annotation-click"] >= 1 ||
      reusedScenarios.includes("annotation-activation")) &&
    (events["source-click"] >= 2 ||
      reusedScenarios.includes("map-feature-click")) &&
    (events["popup-close"] >= 1 ||
      reusedScenarios.includes("popup-follow-dismissal")) &&
    (events.location >= 1 || reusedScenarios.includes("navigation-location")) &&
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

/** Additional native observations retained from the focused two-map fixture. */
export const nativeFocusedUiScenarios = [
  "overlapping-map-feature-click",
  "vector-source-hit",
  "delayed-annotation-refresh",
  "independent-map-context",
  "sibling-provider-update",
  "rejected-delayed-stale-location",
  "zoom-constraints",
  "resized-screen-button-touch",
  "rotated-screen-button-touch",
];

/**
 * Requires real renderer/child observations as well as every focused physical outcome.
 * @param {object} observation - Final fresh read from the focused native fixture.
 * @param {object} manual - Physical outcomes bound to this installed binary and run.
 * @param {object} identity - Independently verified native/library identity.
 * @returns {object} A pass only when both evidence sources are complete.
 */
export const judgeNativeFocusedUi = (observation, manual, identity) => {
  const counts = observation?.counts ?? {};
  const bounds = (value) =>
    Array.isArray(value) &&
    value.length === 4 &&
    value.every(Number.isFinite) &&
    value[0] >= 0 &&
    value[1] >= 0 &&
    value[2] > 0 &&
    value[3] > 0;
  const observed =
    observation?.focused === true &&
    observation.focusedComplete === true &&
    observation.readSequence > 0 &&
    [observation.aZoom, observation.bZoom].every(Number.isFinite) &&
    observation.bZoom >= 11.9 &&
    observation.bZoom <= 13.1 &&
    [observation.aCenter, observation.bCenter].every(
      (value) =>
        Array.isArray(value) &&
        value.length === 2 &&
        value.every(Number.isFinite)
    ) &&
    bounds(observation.aViewport) &&
    bounds(observation.bViewport) &&
    [707, 708].every((id) =>
      observation.overlap?.some((feature) => String(feature.id) === String(id))
    ) &&
    observation.vector?.length > 0 &&
    counts["high-click"] >= 2 &&
    counts["a-map-click"] >= 2 &&
    counts["vector-click"] >= 1 &&
    counts["image-load"] >= 1 &&
    counts["image-refresh"] >= 1 &&
    counts["provider-call"] >= 3 &&
    counts["provider-error"] >= 1 &&
    counts["provider-location"] >= 1 &&
    counts["Map A-click"] >= 3 &&
    counts["Map B-click"] >= 3 &&
    observation.theme === "updated" &&
    !counts["a-error"] &&
    !counts["b-error"] &&
    !counts["image-error"] &&
    !counts["read-error"] &&
    !counts["Map A-map-error"] &&
    !counts["Map B-map-error"];
  const manualComplete =
    /^[a-f0-9]{64}$/.test(identity.installedBinarySha256) &&
    /^[a-f0-9]{64}$/.test(identity.libraryDistSha256) &&
    nativeUiReportReady(manual, identity, nativeFocusedUiScenarios) &&
    nativeFocusedUiScenarios.every(
      (scenario) => manual.scenarios[scenario] === "passed"
    );
  return {
    status: observed && manualComplete ? "passed" : "unverified",
    execution: "manual-native-touch",
    observed,
    manualComplete,
    remaining: nativeFocusedUiScenarios.filter(
      (scenario) => manual?.scenarios?.[scenario] !== "passed"
    ),
  };
};
