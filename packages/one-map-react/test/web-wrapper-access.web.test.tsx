import { act, render } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, test, vi } from "vite-plus/test";

import { MapSetup } from "../src/facade/map-setup.js";
import { Map as OneMap, useMap } from "../src/facade/map.js";
import type { createWebMapMock } from "./create-web-map-mock.js";

vi.mock("react-map-gl/mapbox", async () => {
  const { createWebMapMock } = await import("./create-web-map-mock.js");
  return createWebMapMock();
});
vi.mock("react-map-gl/maplibre", async () => {
  const { createWebMapMock } = await import("./create-web-map-mock.js");
  return createWebMapMock();
});

import * as mapboxWrapper from "react-map-gl/mapbox";
import * as maplibreWrapper from "react-map-gl/maplibre";

import * as mapbox from "../src/mapbox-web.js";
import * as maplibre from "../src/maplibre-web.js";

type MockModule = ReturnType<typeof createWebMapMock>;
type SelectedRef = mapbox.WebMapRef & maplibre.WebMapRef;
const camera = { longitude: 0, latitude: 0, zoom: 0, bearing: 0, pitch: 0 };
const style = { version: 8 as const, sources: {}, layers: [] };

describe.each([
  ["mapbox", mapbox, mapboxWrapper],
  ["maplibre", maplibre, maplibreWrapper],
] as const)("%s wrapper access", (_engine, entry, wrapper) => {
  test.each(["selected", "enclosing", "named"] as const)(
    "%s refs borrow the current wrapper before load and reject after detachment",
    async (access) => {
      const mock = wrapper as unknown as MockModule;
      mock.resetWebMapMock();
      const ref = createRef<SelectedRef>();
      let observed: SelectedRef | undefined;
      const Probe = () => {
        // The common type deliberately omits selected access; exercise its runtime proxy.
        // eslint-disable-next-line react/globals -- Capture the real facade proxy for lifecycle assertions.
        observed = useMap(access === "named" ? "borrowed" : undefined) as
          | SelectedRef
          | undefined;
        return null;
      };
      const MapComponent = access === "selected" ? entry.Map : OneMap;
      const loaded = vi.fn();
      const mounted = render(
        <MapSetup adapter={entry.adapter}>
          <MapComponent
            id="borrowed"
            ref={ref}
            mapStyle={style}
            initialViewState={camera}
            onLoad={loaded}
          >
            {access !== "selected" && <Probe />}
          </MapComponent>
        </MapSetup>
      );
      const retained = access === "selected" ? ref.current : observed;
      if (!retained) throw new Error("Map ref was not attached.");
      const getWrapperMap = retained.getWrapperMap;
      const first = getWrapperMap();
      expect(first).toBeInstanceOf(Promise);
      const original = await first;
      expect(original).toBe(mock.getWrapperMap());
      expect(original).not.toBe(mock.getStyleTarget());
      expect(original.getMap()).toBe(mock.getStyleTarget());
      expect(mock.getStyleTarget()?.isStyleLoaded()).toBe(false);
      expect(loaded).not.toHaveBeenCalled();
      await expect(Promise.resolve(retained)).resolves.toBe(retained);
      await expect(retained.getCenter()).resolves.toEqual([-122.34, 47.61]);

      act(() => mock.replaceWrapperMap());
      const replacement = await getWrapperMap();
      expect(replacement).toBe(mock.getWrapperMap());
      expect(replacement).not.toBe(original);
      expect(replacement.getMap()).toBe(original.getMap());
      await expect(retained.getWrapperMap()).resolves.toBe(replacement);
      expect(mock.getConstructionCount()).toBe(1);
      await retained.flyTo({ center: [1, 2], zoom: 3 });
      expect(mock.flyTo).toHaveBeenCalledTimes(1);

      mounted.unmount();
      const detached = getWrapperMap();
      expect(detached).toBeInstanceOf(Promise);
      await expect(detached).rejects.toThrow("not attached");
      await expect(retained.getWrapperMap()).rejects.toThrow("not attached");
      await expect(Promise.resolve(retained)).resolves.toBe(retained);
      expect(mock.getConstructionCount()).toBe(1);
    }
  );
});
