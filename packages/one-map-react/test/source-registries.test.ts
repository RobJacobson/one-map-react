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
