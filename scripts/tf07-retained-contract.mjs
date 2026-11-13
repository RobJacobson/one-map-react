/** Supplemental retained native observations; the thirteen core receipts stay separate. */
export const nativeRetainedScenarios = [
  "simultaneous-named-maps",
  "provider-child-state",
  "annotation-image-refresh",
  "resize-orientation",
  "camera-target-isolation",
  "touch-density-bounds",
];

/**
 * Checks completion of receipts tied to the installed binary and current run.
 * @param {object | undefined} manual - Operator outcomes.
 * @param {object} identity - Installed binary, library, environment and run identity.
 * @returns {boolean} Whether every current receipt records passed or failed.
 */
export const nativeRetainedReportReady = (manual, identity) =>
  ["installedBinarySha256", "libraryDistSha256", "environment", "runId"].every(
    (field) => manual?.[field] === identity[field]
  ) &&
  nativeRetainedScenarios.every((name) =>
    ["passed", "failed"].includes(manual?.scenarios?.[name])
  );

/**
 * Judges actual two-map readbacks together with physical operator receipts.
 * @param {object} observation - Renderer, named-child and measured host observations.
 * @param {object | undefined} manual - Run-bound physical and visual outcomes.
 * @param {object} identity - Independently verified installed binary and current run.
 * @returns {object} A pass requires renderer evidence and all six physical receipts.
 */
export const judgeNativeRetained = (observation, manual, identity) => {
  const observations = observation?.observations ?? [];
  const reads = observations.filter(validRead);
  const current = observations.at(-1);
  const valid = reads.length >= 3 && validRead(current);
  const themes = ["initial", "updated"].every((theme) =>
    reads.some((read) =>
      ["a", "b"].every(
        (name) =>
          read.children?.[name]?.theme === theme &&
          read.children[name].count >= (theme === "initial" ? 1 : 2)
      )
    )
  );
  const resized =
    valid &&
    reads.some((read) => read.short === true) &&
    reads.some((read) => read.short === false) &&
    reads.some((read) => current && read.a.bounds[3] !== current.a.bounds[3]);
  const rotated =
    valid &&
    reads.some((read) => read.window.width > read.window.height) &&
    reads.some((read) => read.window.width < read.window.height);
  const isolated =
    valid &&
    reads.some((read) =>
      reads.some(
        (other) =>
          distance(read.a.center, other.a.center) > 0.001 &&
          distance(read.b.center, other.b.center) < 0.0001
      )
    );
  const events = current?.events ?? {};
  const observed =
    observation?.focusedComplete === true &&
    valid &&
    themes &&
    resized &&
    rotated &&
    isolated &&
    events["image-load"] >= 1 &&
    events["image-refresh"] >= 1 &&
    events["a-feature-touch"] >= 1 &&
    events["b-feature-touch"] >= 1 &&
    !Object.keys(events).some(
      (name) => name.endsWith("error") && events[name] > 0
    );
  const manualComplete =
    /^[a-f0-9]{64}$/.test(identity.installedBinarySha256) &&
    /^[a-f0-9]{64}$/.test(identity.libraryDistSha256) &&
    nativeRetainedReportReady(manual, identity) &&
    nativeRetainedScenarios.every(
      (name) => manual.scenarios[name] === "passed"
    );
  return {
    status: observed && manualComplete ? "passed" : "unverified",
    execution: "manual-native-touch",
    observed,
    manualComplete,
    density: current?.window?.scale,
    remaining: nativeRetainedScenarios.filter(
      (name) => manual?.scenarios?.[name] !== "passed"
    ),
  };
};

/**
 * Checks the coordinator's density matrix across approved native results.
 * @param {object[]} results - Current passed or unverified native environment rows.
 * @returns {boolean} Whether each engine passed at two distinct actual densities.
 */
export const judgeNativeDensityMatrix = (results) =>
  ["mapbox", "maplibre"].every(
    (engine) =>
      new Set(
        results
          .filter(
            (result) =>
              result.status === "passed" &&
              result.environment?.startsWith(`${engine}-`) &&
              Number.isFinite(result.density) &&
              result.density > 0
          )
          .map((result) => result.density)
      ).size >= 2
  );

const distance = (first, second) =>
  Math.hypot(first[0] - second[0], first[1] - second[1]);
const validRead = (read) =>
  Number.isFinite(read?.window?.scale) &&
  read.window.scale > 0 &&
  Number.isFinite(read.window.width) &&
  read.window.width > 0 &&
  Number.isFinite(read.window.height) &&
  read.window.height > 0 &&
  ["a", "b"].every((name) => {
    const map = read?.[name];
    const id = name === "a" ? "1707" : "2707";
    const child = read.children?.[name];
    return (
      child?.center?.length === 2 &&
      child.center.every(Number.isFinite) &&
      Number.isFinite(child.zoom) &&
      distance(child.center, map?.center ?? [Infinity, Infinity]) < 0.02 &&
      Math.abs(child.zoom - map?.zoom) < 0.25 &&
      map?.center?.length === 2 &&
      map.center.every(Number.isFinite) &&
      Number.isFinite(map.zoom) &&
      map.bounds?.length === 4 &&
      map.bounds.every(Number.isFinite) &&
      map.bounds[0] >= 0 &&
      map.bounds[1] >= 0 &&
      map.bounds[2] > 0 &&
      map.bounds[3] > 0 &&
      map.point?.length === 2 &&
      map.point.every(Number.isFinite) &&
      map.point[0] >= 0 &&
      map.point[0] <= map.bounds[2] &&
      map.point[1] >= 0 &&
      map.point[1] <= map.bounds[3] &&
      map.features?.some(
        (feature) =>
          String(feature.id) === id &&
          feature.properties?.fixture === `tf07-focus-${name}`
      )
    );
  });
