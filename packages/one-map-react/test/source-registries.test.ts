import { expect, test } from "vite-plus/test";

import { GeoJsonSourceRegistry } from "../src/adapters/mapbox-native/geojson-source-registry.js";
import {
  type MaplibreNativeSourceRef,
  MaplibreSourceRegistry,
} from "../src/adapters/maplibre-native/source-registry.js";

test("RNMapbox stale cleanup cannot delete a replacement registration, even with the same ref", () => {
  const registry = new GeoJsonSourceRegistry(async () => {});
  // Only identity is relevant; the wrapper methods are not called in this test.
  const ref = {} as Parameters<GeoJsonSourceRegistry["register"]>[1];
  const oldCleanup = registry.register("routes", ref);
  const cleanup = registry.register("routes", ref);
  oldCleanup();
  expect(registry.require("routes")).toBe(ref);
  cleanup();
  expect(() => registry.require("routes")).toThrow("not a mounted");
});

test("MapLibre stale cleanup cannot delete a replacement using the same entry", () => {
  const registry = new MaplibreSourceRegistry();
  const entry = { kind: "geojson", ref: {} } as MaplibreNativeSourceRef;
  const oldCleanup = registry.register("routes", () => entry, "geojson");
  const cleanup = registry.register("routes", () => entry, "geojson");
  oldCleanup();
  expect(registry.require("routes")).toBe(entry);
  cleanup();
  expect(() => registry.require("routes")).toThrow("not a mounted");
});

test.each(
  (["mapbox", "maplibre"] as const).flatMap((backend) =>
    (["geojson", "vector"] as const).map((kind) => ({ backend, kind }))
  )
)(
  "$backend $kind releases 10000 unwritten source lifetimes",
  async ({ backend, kind }) => {
    const registry =
      backend === "mapbox"
        ? new GeoJsonSourceRegistry(async () => {})
        : new MaplibreSourceRegistry();
    for (let index = 0; index < 10000; index += 1) {
      const id = `temporary-${index}`;
      if (registry instanceof MaplibreSourceRegistry)
        registry.register(id, () => undefined, kind)();
      else if (kind === "geojson") registry.register(id, null)();
      else registry.featureState.register(id, kind)();
    }
    await registry.featureState.flush(() => {});
    // Storage inspection verifies reclamation without adding a production diagnostic API.
    const history = (
      registry.featureState as unknown as {
        sources: ReadonlyMap<string, unknown>;
      }
    ).sources;
    expect(history.size).toBe(0);
  }
);
