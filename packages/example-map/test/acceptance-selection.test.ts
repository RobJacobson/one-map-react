import { describe, expect, it } from "vite-plus/test";

import {
  acceptanceScenario,
  acceptanceScenarios,
  webAcceptanceScenarios,
  webAcceptanceSelection,
  webAcceptanceUrl,
} from "../src/acceptance-selection.js";

describe("workspace acceptance selection", () => {
  it("keeps normal startup on the basemap", () => {
    expect(webAcceptanceSelection("?test=1").scenario).toBeUndefined();
  });
  it.each([
    ["?scenario=basemap&test=1&engine=mapbox", "mapbox"],
    ["?scenario=basemap&tf04=camera&engine=maplibre", "maplibre"],
  ])("opens the basemap from the old URL %s", (search, engine) => {
    expect(webAcceptanceSelection(search)).toEqual({
      engine,
      scenario: undefined,
    });
  });
  it.each(acceptanceScenarios)(
    "preserves explicit %s selection and engine",
    (scenario) => {
      expect(
        webAcceptanceSelection(`?scenario=${scenario}&engine=mapbox`)
      ).toEqual({ engine: "mapbox", scenario });
    }
  );
  it.each([
    ["tf03=reuse&auto=1", "tf03"],
    ["tf03=gl&auto=1", "tf03"],
    ["tf04=camera", "tf04"],
    ["tf04=corrections", "corrections"],
    ["tf05=sources", "tf05"],
    ["tf05=corrections", "corrections"],
    ["tf06=queries", "tf06"],
    ["tf07=ui", "tf07"],
    ["tf08=services", "tf08"],
    ["tf09=rendering", "tf09"],
    ["tf10=global-state", "global-state"],
  ])("keeps existing runner query %s", (query, scenario) => {
    expect(webAcceptanceSelection(`?${query}&engine=maplibre`)).toEqual({
      engine: "maplibre",
      scenario,
    });
  });
  it("rejects unknown selection before renderer creation", () => {
    expect(() => acceptanceScenario("bogus")).toThrow("Unknown acceptance");
    expect(() => acceptanceScenario("basemap")).toThrow("Unknown acceptance");
    expect(() => webAcceptanceSelection("?scenario=bogus")).toThrow();
    expect(() => webAcceptanceSelection("?engine=bogus")).toThrow();
  });
});

describe("workspace web scenario choices", () => {
  it("offers only the scenarios available on each web engine", () => {
    const portable = [
      "tf03",
      "tf04",
      "corrections",
      "tf05",
      "tf06",
      "tf07",
      "tf07-focused",
      "tf08",
      "tf09",
    ];

    expect(webAcceptanceScenarios("mapbox")).toEqual(portable);
    expect(webAcceptanceScenarios("maplibre")).toEqual([
      ...portable,
      "global-state",
    ]);
  });
});

describe("workspace scenario navigation", () => {
  it("keeps unrelated URL state when returning to the basemap", () => {
    const href =
      "https://example.test/?scenario=basemap&tf07-focused=1&tf04=camera" +
      "&engine=mapbox&test=1&debug=1#map";
    const next = new URL(webAcceptanceUrl(href, "maplibre", undefined));
    expect(Object.fromEntries(next.searchParams)).toEqual({
      engine: "maplibre",
      test: "1",
      debug: "1",
    });
    expect(next.hash).toBe("#map");
  });
  it("selects portable advanced rendering when changing global state to Mapbox", () => {
    const next = new URL(
      webAcceptanceUrl(
        "https://example.test/?tf10=global-state",
        "mapbox",
        "global-state"
      )
    );
    expect(webAcceptanceSelection(next.search)).toEqual({
      engine: "mapbox",
      scenario: "tf09",
    });
  });
});
