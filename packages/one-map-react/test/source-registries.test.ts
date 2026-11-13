import { expect, test } from "vite-plus/test";

import { GeoJsonSourceRegistry } from "../src/adapters/mapbox-native/geojson-source-registry.js";
import {
  type MaplibreNativeSourceRef,
  MaplibreSourceRegistry,
} from "../src/adapters/maplibre-native/source-registry.js";

test("RNMapbox stale cleanup cannot delete a replacement registration, even with the same ref", () => {
  const registry = new GeoJsonSourceRegistry();
  // Only identity is relevant; the wrapper methods are not called in this test.
  const ref = {} as ReturnType<
    Parameters<GeoJsonSourceRegistry["register"]>[1]
  >;
  const oldCleanup = registry.register("routes", () => ref);
  const cleanup = registry.register("routes", () => ref);
  oldCleanup();
  expect(registry.require("routes")).toBe(ref);
  cleanup();
  expect(() => registry.require("routes")).toThrow("not a mounted");
});

test("MapLibre stale cleanup cannot delete a replacement using the same entry", () => {
  const registry = new MaplibreSourceRegistry();
  const entry = { kind: "geojson", ref: {} } as MaplibreNativeSourceRef;
  const oldCleanup = registry.register("routes", () => entry);
  const cleanup = registry.register("routes", () => entry);
  oldCleanup();
  expect(registry.require("routes")).toBe(entry);
  cleanup();
  expect(() => registry.require("routes")).toThrow("not a mounted");
});

test("RNMapbox cluster lookup reads the current source ref and rejects detachment", () => {
  const registry = new GeoJsonSourceRegistry();
  type Ref = ReturnType<Parameters<GeoJsonSourceRegistry["register"]>[1]>;
  let ref = {} as Ref;
  registry.register("routes", () => ref);
  expect(registry.require("routes")).toBe(ref);
  ref = {} as Ref;
  expect(registry.require("routes")).toBe(ref);
  ref = null;
  expect(() => registry.require("routes")).toThrow("not a mounted");
});

test("MapLibre lookup reads current source family and rejects detachment", () => {
  const registry = new MaplibreSourceRegistry();
  let entry: MaplibreNativeSourceRef | undefined = {
    kind: "geojson",
    ref: {},
  } as MaplibreNativeSourceRef;
  registry.register("routes", () => entry);
  expect(registry.requireGeoJson("routes")).toBe(entry.ref);
  entry = { kind: "vector", ref: {} } as MaplibreNativeSourceRef;
  expect(registry.require("routes")).toBe(entry);
  expect(() => registry.requireGeoJson("routes")).toThrow("not a GeoJSON");
  entry = undefined;
  expect(() => registry.require("routes")).toThrow("not a mounted");
});

test.each(["mapbox", "maplibre"] as const)(
  "%s cleanup leaves unrelated source registrations available",
  (backend) => {
    if (backend === "mapbox") {
      const registry = new GeoJsonSourceRegistry();
      const ref = {} as NonNullable<
        ReturnType<Parameters<GeoJsonSourceRegistry["register"]>[1]>
      >;
      registry.register("other", () => ref);
      registry.register("routes", () => ref)();
      expect(registry.require("other")).toBe(ref);
      expect(() => registry.require("routes")).toThrow("not a mounted");
    } else {
      const registry = new MaplibreSourceRegistry();
      const entry = { kind: "geojson", ref: {} } as MaplibreNativeSourceRef;
      registry.register("other", () => entry);
      registry.register("routes", () => entry)();
      expect(registry.require("other")).toBe(entry);
      expect(() => registry.require("routes")).toThrow("not a mounted");
    }
  }
);
