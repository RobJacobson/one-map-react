import type { ShapeSource } from "@rnmapbox/maps";
import type { ComponentRef } from "react";
import { expect, test } from "vite-plus/test";

import { createGeoJsonSourceRegistry } from "../src/adapters/mapbox-native/geojson-source-registry.js";
import {
  type MaplibreNativeSourceRef,
  createMaplibreSourceRegistry,
} from "../src/adapters/maplibre-native/source-registry.js";
import type { NativeSourceRegistry } from "../src/adapters/shared/native-source-registry.js";

type ShapeRef = ComponentRef<typeof ShapeSource>;

const checkReplacement = <Source, GeoJsonRef>(
  registry: NativeSourceRegistry<Source, GeoJsonRef>,
  source: Source,
  ref: GeoJsonRef
) => {
  // Reusing the getter and ref makes registration identity the only difference.
  const read = () => source;
  registry.register("other", read);
  const oldCleanup = registry.register("routes", read);
  const oldOwner = registry.getGeoJsonOwner("routes");
  expect(oldOwner?.()).toBe(ref);

  const cleanup = registry.register("routes", read);
  const owner = registry.getGeoJsonOwner("routes");
  expect(owner).not.toBe(oldOwner);
  expect(() => oldOwner?.()).toThrow("no longer mounted");
  oldCleanup();
  expect(owner?.()).toBe(ref);
  expect(registry.require("routes")).toBe(source);

  cleanup();
  expect(() => owner?.()).toThrow("no longer mounted");
  expect(() => registry.require("routes")).toThrow("not a mounted");
  expect(registry.require("other")).toBe(source);
};

test("RNMapbox replacement invalidates only the old registration", () => {
  const ref = {} as ShapeRef;
  checkReplacement(createGeoJsonSourceRegistry(), ref, ref);
});

test("MapLibre replacement invalidates only the old registration", () => {
  const entry = { kind: "geojson", ref: {} } as Extract<
    MaplibreNativeSourceRef,
    { kind: "geojson" }
  >;
  checkReplacement(createMaplibreSourceRegistry(), entry, entry.ref);
});

test("RNMapbox cluster lookup and captured owner track ref refresh, detachment and restoration", () => {
  const registry = createGeoJsonSourceRegistry();
  let ref: ShapeRef | null = {} as ShapeRef;
  registry.register("routes", () => ref);
  const owner = registry.getGeoJsonOwner("routes");
  expect(owner?.()).toBe(ref);
  expect(registry.require("routes")).toBe(ref);
  ref = {} as ShapeRef;
  expect(registry.getGeoJsonOwner("routes")).toBe(owner);
  expect(owner?.()).toBe(ref);
  expect(registry.require("routes")).toBe(ref);
  ref = null;
  expect(registry.getGeoJsonOwner("routes")).toBeUndefined();
  expect(() => owner?.()).toThrow("no longer mounted");
  expect(() => registry.require("routes")).toThrow("not a mounted");
  ref = {} as ShapeRef;
  expect(registry.getGeoJsonOwner("routes")).toBe(owner);
  expect(owner?.()).toBe(ref);
});

test("MapLibre cluster lookup and captured owner track the current source family and ref", () => {
  const registry = createMaplibreSourceRegistry();
  let entry: MaplibreNativeSourceRef | undefined = {
    kind: "geojson",
    ref: {},
  } as MaplibreNativeSourceRef;
  registry.register("routes", () => entry);
  const owner = registry.getGeoJsonOwner("routes");
  expect(owner?.()).toBe(entry.ref);
  expect(registry.requireGeoJson("routes")).toBe(entry.ref);
  entry = { kind: "vector", ref: {} } as MaplibreNativeSourceRef;
  expect(registry.getGeoJsonOwner("routes")).toBeUndefined();
  expect(() => owner?.()).toThrow("no longer mounted");
  expect(registry.require("routes")).toBe(entry);
  expect(() => registry.requireGeoJson("routes")).toThrow("not a GeoJSON");
  entry = undefined;
  expect(registry.getGeoJsonOwner("routes")).toBeUndefined();
  expect(() => owner?.()).toThrow("no longer mounted");
  expect(() => registry.require("routes")).toThrow("not a mounted");
  entry = { kind: "geojson", ref: {} } as MaplibreNativeSourceRef;
  expect(registry.getGeoJsonOwner("routes")).toBe(owner);
  expect(owner?.()).toBe(entry.ref);
  expect(registry.requireGeoJson("routes")).toBe(entry.ref);
});
