import { render } from "@testing-library/react";
import {
  createRef,
  forwardRef,
  type ReactNode,
  useImperativeHandle,
} from "react";
import { describe, expect, test, vi } from "vite-plus/test";

import {
  normalizeElevation,
  validateTerrainCoordinate,
} from "../src/adapters/shared/terrain-values.js";
import type {
  WebMapHandle,
  WebWrapper,
} from "../src/adapters/web/contracts.js";
import { createWebMap } from "../src/adapters/web/map.js";
import type { MapRef } from "../src/contracts/camera-types.js";

const camera = { longitude: 0, latitude: 0, zoom: 0, bearing: 0, pitch: 0 };
const style = { version: 8 as const, sources: {}, layers: [] };
const fixture = (backend: "mapbox-web" | "maplibre-web") => {
  let props: Record<string, unknown> = {};
  const listeners = new Set<(event: { error?: unknown }) => void>();
  const query = vi.fn<(...args: unknown[]) => unknown>(() => 0);
  const handle = {
    queryTerrainElevation: query,
    getMap: () => ({
      on: (type: string, listener: (event: { error?: unknown }) => void) => {
        if (type === "error") listeners.add(listener);
      },
      off: (type: string, listener: (event: { error?: unknown }) => void) => {
        if (type === "error") listeners.delete(listener);
      },
      isStyleLoaded: () => true,
    }),
  } as unknown as WebMapHandle;
  const Wrapper = forwardRef<WebMapHandle, { children?: ReactNode }>(
    (value, ref) => {
      // eslint-disable-next-line react/globals -- Mocked wrapper readback.
      props = value;
      useImperativeHandle(ref, () => handle, []);
      return <div>{value.children}</div>;
    }
  );
  const Component = createWebMap({
    backend,
    Map: Wrapper,
  } as unknown as WebWrapper<typeof backend>);
  return { Component, props: () => props, query, listeners };
};

describe.each(["mapbox-web", "maplibre-web"] as const)(
  "%s rendering",
  (backend) => {
    test("forwards terrain, projection, legacy light and resets without mutating inputs", () => {
      const { Component, props } = fixture(backend);
      const terrain = Object.freeze({ source: "dem", exaggeration: 0 });
      const light = Object.freeze({
        intensity: 0,
        "intensity-transition": { duration: 0 },
      });
      const mounted = render(
        <Component
          mapStyle={style}
          initialViewState={camera}
          terrain={terrain}
          projection="globe"
          light={light}
          options={{ locale: { hello: "world" }, minZoom: 4 }}
        />
      );
      expect(props()).toMatchObject({
        terrain,
        light,
        minZoom: 4,
        projection:
          backend === "mapbox-web" ? { name: "globe" } : { type: "globe" },
        locale: { hello: "world" },
      });
      mounted.rerender(
        <Component
          mapStyle={style}
          initialViewState={camera}
          terrain={null}
          projection="mercator"
        />
      );
      expect(props().terrain).toBeNull();
      expect(terrain.exaggeration).toBe(0);
      mounted.unmount();
    });

    test("preserves selected rendering values on omission and common values take precedence", () => {
      const { Component, props } = fixture(backend);
      const options = {
        terrain: { source: "selected" },
        projection: { type: "globe" as const },
        light: { intensity: 0.5 },
        minZoom: 2,
      };
      const mounted = render(
        <Component
          mapStyle={style}
          initialViewState={camera}
          options={options}
          minZoom={0}
        />
      );
      expect(props()).toMatchObject({ ...options, minZoom: 0 });
      mounted.rerender(
        <Component mapStyle={style} initialViewState={camera} />
      );
      expect(Object.hasOwn(props(), "terrain")).toBe(false);
      mounted.unmount();
    });

    test("elevation preserves zero/null, rejects failures and releases listeners", async () => {
      const { Component, query, listeners } = fixture(backend);
      const ref = createRef<MapRef>();
      const mounted = render(
        <Component ref={ref} mapStyle={style} initialViewState={camera} />
      );
      await expect(ref.current?.queryTerrainElevation([0, 0])).resolves.toBe(0);
      query.mockReturnValue(null);
      await expect(
        ref.current?.queryTerrainElevation([0, 0])
      ).resolves.toBeNull();
      query.mockReturnValue(Number.NaN);
      await expect(ref.current?.queryTerrainElevation([0, 0])).rejects.toThrow(
        "finite"
      );
      query.mockImplementation(() => {
        for (const listener of listeners)
          listener({ error: new Error("tile failed") });
        return null;
      });
      await expect(ref.current?.queryTerrainElevation([0, 0])).rejects.toThrow(
        "tile failed"
      );
      expect(listeners.size).toBe(0);
      await expect(
        ref.current?.queryTerrainElevation([0, 91])
      ).rejects.toBeInstanceOf(RangeError);
      mounted.unmount();
    });
  }
);

test.each([0, -10, 1200, null, undefined])(
  "normalizes elevation %s",
  (value) => {
    expect(normalizeElevation(value)).toBe(value ?? null);
  }
);
test("validates terrain coordinates before wrapper dispatch", () => {
  expect(() => validateTerrainCoordinate([Number.NaN, 0])).toThrow(RangeError);
  expect(() => validateTerrainCoordinate([0, 90])).not.toThrow();
});
