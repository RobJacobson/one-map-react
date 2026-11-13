import { describe, expect, it } from "vite-plus/test";

import {
  acceptanceScenario,
  acceptanceScenarios,
  webAcceptanceSelection,
  webAcceptanceUrl,
} from "../src/acceptance-selection.js";

describe("workspace acceptance selection", () => {
  it("keeps normal startup on the basemap", () => {
    expect(webAcceptanceSelection("?test=1").scenario).toBeUndefined();
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
    expect(() => webAcceptanceSelection("?scenario=bogus")).toThrow();
    expect(() => webAcceptanceSelection("?engine=bogus")).toThrow();
  });
});

describe("workspace scenario navigation", () => {
  it("clears every legacy selector when returning to the basemap", () => {
    const next = new URL(
      webAcceptanceUrl(
        "https://example.test/?tf07-focused=1&tf04=camera&test=1",
        "maplibre",
        undefined
      )
    );
    expect(webAcceptanceSelection(next.search)).toEqual({
      engine: "maplibre",
      scenario: undefined,
    });
    expect(next.searchParams.get("test")).toBe("1");
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
