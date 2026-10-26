import { act, fireEvent, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { expect, test, vi } from "vite-plus/test";

import { App as MapboxApp } from "../../../examples/web-mapbox/src/app.js";
import { App as MaplibreApp } from "../../../examples/web-maplibre/src/app.js";

const ornaments = vi.hoisted(() => ({
  scale: [] as Array<Record<string, unknown>>,
  attribution: [] as Array<Record<string, unknown>>,
}));

vi.mock("one-map-react", async (original) => {
  const actual = await original<typeof import("one-map-react")>();
  const react = await import("react");
  const Content = ({ children }: { children?: ReactNode }) => children;
  const Empty = () => null;
  return {
    ...actual,
    MapSetup: Content,
    Map: react.forwardRef(({ children }: { children?: ReactNode }, _ref) => (
      <div>{children}</div>
    )),
    Marker: Empty,
    Source: Content,
    Layer: Empty,
    Control: Empty,
    GeolocateControl: Empty,
  };
});
vi.mock("one-map-react/mapbox-web", () => ({
  adapter: { backend: "mapbox-web", services: { location: {} } },
  WrapperPopup: () => null,
  WrapperNavigationControl: () => null,
  WrapperScaleControl: (props: Record<string, unknown>) => {
    ornaments.scale.push(props);
    return null;
  },
  WrapperAttributionControl: (props: Record<string, unknown>) => {
    ornaments.attribution.push(props);
    return null;
  },
}));
vi.mock("one-map-react/maplibre-web", () => ({
  adapter: { backend: "maplibre-web", services: { location: {} } },
  WrapperPopup: () => null,
  WrapperNavigationControl: () => null,
  WrapperScaleControl: (props: Record<string, unknown>) => {
    ornaments.scale.push(props);
    return null;
  },
  WrapperAttributionControl: (props: Record<string, unknown>) => {
    ornaments.attribution.push(props);
    return null;
  },
}));

test.each([MapboxApp, MaplibreApp])(
  "web entries delegate mutable scale units and attribution placement to raw wrappers",
  async (App) => {
    window.history.replaceState(null, "", "?tf07=ui");
    const scene = render(<App />);
    expect(ornaments.scale.at(-1)).toEqual({
      position: "bottom-left",
      unit: "metric",
    });
    fireEvent.click(scene.getByRole("button", { name: "units" }));
    expect(ornaments.scale.at(-1)).toEqual({
      position: "bottom-left",
      unit: "imperial",
    });
    scene.unmount();
    window.history.replaceState(null, "", "?tf08=services");
    const coverage = render(<App />);
    await act(async () => {
      await window.__oneMapTf08?.command("configure", {
        mode: "coverage-ornaments",
      });
    });
    expect(ornaments.attribution.at(-1)).toEqual({ position: "bottom-right" });
    expect(ornaments.scale.at(-1)).toEqual({ position: "bottom-left" });
    coverage.unmount();
  }
);
