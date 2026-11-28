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
 *
 * @param value - Explicit scenario name from a development control or launch setting.
 * @returns The supported scenario.
 * @throws Error when the scenario is unknown.
 */
export const acceptanceScenario = (value: string): AcceptanceScenario => {
  const scenario = acceptanceScenarios.find((candidate) => candidate === value);
  if (!scenario) {
    throw new Error(`Unknown acceptance scenario: ${value}`);
  }
  return scenario;
};

/**
 * Lists the scenarios offered by the web development controls.
 *
 * @param engine - Engine used to run the scenario.
 * @returns Scenarios that run on the selected web engine, in menu order.
 */
export const webAcceptanceScenarios = (
  engine: Engine
): readonly AcceptanceScenario[] => {
  const isAvailableOnWeb = (scenario: AcceptanceScenario) =>
    scenario !== "tf06-lifetimes" &&
    scenario !== "tf07-retained" &&
    scenario !== "tf08-storage" &&
    scenario !== "tf09-model" &&
    (scenario !== "global-state" || engine === "maplibre");

  return acceptanceScenarios.filter(isAvailableOnWeb);
};

/**
 * Reads the explicit workspace query while preserving existing runner queries.
 *
 * @param search - Browser location search string.
 * @returns The selected engine and scenario, or an undefined scenario for the basemap.
 * @throws Error when the engine or scenario is unknown.
 */
export const webAcceptanceSelection = (
  search: string
): {
  readonly engine: Engine;
  readonly scenario: AcceptanceScenario | undefined;
} => {
  const query = new URLSearchParams(search);
  const engine = query.get("engine") ?? "maplibre";
  if (engine !== "mapbox" && engine !== "maplibre") {
    throw new Error("Choose mapbox or maplibre.");
  }

  const requested = query.get("scenario");
  if (requested === "basemap") {
    return { engine, scenario: undefined };
  }

  const scenario = requested || legacyScenario(query);
  return {
    engine,
    scenario: scenario ? acceptanceScenario(scenario) : undefined,
  };
};

/**
 * Replaces legacy query selectors with one supported workspace selection.
 *
 * @param href - Current browser URL.
 * @param engine - Destination engine.
 * @param scenario - Destination scenario, or undefined for the basemap.
 * @returns The next browser URL with the hash and unrelated parameters preserved.
 */
export const webAcceptanceUrl = (
  href: string,
  engine: Engine,
  scenario: AcceptanceScenario | undefined
): string => {
  const url = new URL(href);
  url.searchParams.delete("scenario");
  for (const key of legacyScenarioKeys) {
    url.searchParams.delete(key);
  }
  url.searchParams.set("engine", engine);
  if (scenario) {
    url.searchParams.set(
      "scenario",
      scenario === "global-state" && engine === "mapbox" ? "tf09" : scenario
    );
  }
  return url.href;
};

/** Resolves old runner queries in their original precedence order. */
const legacyScenario = (query: URLSearchParams) => {
  let scenario: string | undefined;
  for (const family of legacyScenarioKeys) {
    const value = query.get(family);
    if (value) {
      scenario =
        value === "corrections" || value === "global-state" ? value : family;
    }
  }
  return scenario;
};

const legacyScenarioKeys = [
  "tf03",
  "tf04",
  "tf05",
  "tf06",
  "tf07",
  "tf07-focused",
  "tf08",
  "tf09",
  "tf10",
] as const;
