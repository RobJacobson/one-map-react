import type {
  GeoJSONSource,
  VectorSource,
} from "@maplibre/maplibre-react-native";
import type { ComponentRef } from "react";
import { createContext } from "react";

import { NativeSourceRegistry } from "../shared/native-source-registry.js";

/**
 * A registered MapLibre React Native source ref.
 *
 * GeoJSON refs carry cluster and feature-state methods plus `getData`;
 * vector refs carry `querySourceFeatures` and feature-state methods that
 * require a `sourceLayer`.
 */
export type MaplibreNativeSourceRef =
  | {
      readonly kind: "geojson";
      readonly ref: ComponentRef<typeof GeoJSONSource>;
    }
  | {
      readonly kind: "vector";
      readonly ref: ComponentRef<typeof VectorSource>;
    };

export type MaplibreSourceRegistry = NativeSourceRegistry<
  MaplibreNativeSourceRef,
  ComponentRef<typeof GeoJSONSource>
>;

/** Creates the source registry for one MapLibre map. */
export const createMaplibreSourceRegistry = (): MaplibreSourceRegistry =>
  new NativeSourceRegistry((source) =>
    source?.kind === "geojson" ? source.ref : undefined
  );

/**
 * Reads the source for a map-scoped query or feature-state operation.
 *
 * @param sources - Registry owned by the attached map.
 * @param id - Source ID supplied by the caller.
 * @returns The attached GeoJSON or vector source.
 * @throws When the requested source has no attached ref.
 */
export const requireMaplibreSource = (
  sources: MaplibreSourceRegistry,
  id: string
): MaplibreNativeSourceRef => {
  const source = sources.get(id);
  if (source === undefined) {
    throw new Error(
      `Source "${id}" is not a mounted GeoJSON or vector Source. Mount it through a Source to use source-scoped methods.`
    );
  }
  return source;
};

/** Sources rendered outside a map have no registration. */
export const MaplibreSourceContext =
  createContext<MaplibreSourceRegistry | null>(null);
