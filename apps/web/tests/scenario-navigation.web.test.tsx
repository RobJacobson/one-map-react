import { fireEvent, render } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vite-plus/test";

import { App } from "../src/App.js";

vi.mock("@one-map/example-map", () => ({
  ExampleMap: () => null,
  publicMapboxToken: () => undefined,
  useExampleMap: () => ({
    attachment: { engine: "maplibre" },
    status: "ready",
  }),
}));
vi.mock("@one-map/example-map/web", () => ({
  configureMapbox: vi.fn(),
  maps: {},
}));
vi.mock("@one-map/example-map/acceptance-web", () => ({
  WebAcceptanceWorkspace: () => null,
}));

afterEach(() => vi.unstubAllGlobals());

test("the basemap picker opens supported routes and clears old scenario selectors", () => {
  const url = new URL(
    "https://example.test/?test=1&scenario=basemap&tf04=camera#map"
  );
  const assign = vi.fn();
  vi.stubGlobal(
    "window",
    Object.create(window, {
      location: { value: { href: url.href, search: url.search, assign } },
    })
  );

  const view = render(<App />);
  const picker = view.getByRole("combobox", { name: "Scenario" });
  expect(view.queryByRole("option", { name: "tf07-retained" })).toBeNull();

  fireEvent.change(picker, { target: { value: "tf07-focused" } });
  expect(assign).toHaveBeenLastCalledWith(
    "https://example.test/?test=1&engine=maplibre&scenario=tf07-focused#map"
  );
  fireEvent.change(picker, { target: { value: "basemap" } });
  expect(assign).toHaveBeenLastCalledWith(
    "https://example.test/?test=1&engine=maplibre#map"
  );
});
