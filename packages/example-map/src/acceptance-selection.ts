import type { Engine } from "./use-example-map.js";

/** Development scenarios retained from the renderer acceptance suites. */
export const acceptanceScenarios = [
  "tf03",
  "tf04",
  "corrections",
  "tf05",
  "tf06",
  "tf06-lifetimes",
  "tf07",
  "tf07-focused",
  "tf07-retained",
  "tf08",
  "tf08-storage",
  "tf09",
  "tf09-model",
  "global-state",
] as const;

/** One development acceptance scenario. */
export type AcceptanceScenario = (typeof acceptanceScenarios)[number];

/** Explicit engine and scenario chosen by a development shell. */
export interface AcceptanceSelection {
  /** Installed engine whose original acceptance probes should run. */
  readonly engine: Engine;
  /** One isolated scenario tree; replacement retires the previous tree. */
  readonly scenario: AcceptanceScenario;
}

/**
 * Validates scenario input before any renderer is created.
 * @param value - Explicit scenario name from a development control or launch setting.
 * @returns The supported scenario, rejecting unknown input.
 */
export const acceptanceScenario = (value: string): AcceptanceScenario => {
  const scenario = acceptanceScenarios.find((candidate) => candidate === value);
  if (!scenario) throw new Error(`Unknown acceptance scenario: ${value}`);
  return scenario;
};

/**
 * Reads the explicit workspace query while preserving existing runner queries.
 * @param search - Browser location search string.
 * @returns The selected engine and optional scenario; absence keeps the normal basemap.
 */
export const webAcceptanceSelection = (
  search: string
): {
  readonly engine: "mapbox" | "maplibre";
  readonly scenario: AcceptanceScenario | undefined;
} => {
  const query = new URLSearchParams(search);
  const engine = query.get("engine") ?? "maplibre";
  if (engine !== "mapbox" && engine !== "maplibre")
    throw new Error("Choose mapbox or maplibre.");
  const requested = query.get("scenario");
  let scenario = requested;
  if (!scenario) {
    for (const family of [
      "tf03",
      "tf04",
      "tf05",
      "tf06",
      "tf07",
      "tf07-focused",
      "tf08",
      "tf09",
      "tf10",
    ]) {
      const value = query.get(family);
      if (value)
        scenario =
          value === "corrections" || value === "global-state" ? value : family;
    }
  }
  return {
    engine,
    scenario: scenario ? acceptanceScenario(scenario) : undefined,
  };
};

/**
 * Replaces legacy query selectors with one supported workspace selection.
 * @param href - Current browser URL.
 * @param engine - Destination engine.
 * @param scenario - Destination scenario, or undefined for the basemap.
 * @returns The next browser URL with unrelated parameters preserved.
 */
export const webAcceptanceUrl = (
  href: string,
  engine: Engine,
  scenario: AcceptanceScenario | undefined
): string => {
  const url = new URL(href);
  for (const key of [
    "scenario",
    "tf03",
    "tf04",
    "tf05",
    "tf06",
    "tf07",
    "tf07-focused",
    "tf08",
    "tf09",
    "tf10",
  ])
    url.searchParams.delete(key);
  url.searchParams.set("engine", engine);
  if (scenario)
    url.searchParams.set(
      "scenario",
      scenario === "global-state" && engine === "mapbox" ? "tf09" : scenario
    );
  return url.href;
};
