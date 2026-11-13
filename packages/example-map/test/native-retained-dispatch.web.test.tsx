import { render } from "@testing-library/react";
import { expect, test, vi } from "vite-plus/test";

import { WebAcceptanceWorkspace } from "../src/acceptance-controls.web.js";
import { WebAcceptance } from "../src/acceptance.web.js";

vi.mock("../src/scenarios/mapbox-web.js", () => ({
  App: () => <div>Mapbox scene</div>,
}));
vi.mock("../src/scenarios/maplibre-web.js", () => ({
  App: () => <div>MapLibre scene</div>,
}));

test("native retained mode cannot silently dispatch a browser fallback", () => {
  for (const engine of ["mapbox", "maplibre"] as const)
    expect(() => WebAcceptance({ engine, scenario: "tf07-retained" })).toThrow(
      "requires a native acceptance host"
    );
});

test("browser scenario controls omit only the new native retained mode", () => {
  const view = render(
    <WebAcceptanceWorkspace engine="maplibre" scenario="tf07" />
  );
  expect(view.queryByRole("option", { name: "tf07-retained" })).toBeNull();
  expect(view.getByRole("option", { name: "tf07-focused" })).toBeTruthy();
  expect(view.getByText("MapLibre scene")).toBeTruthy();
});
