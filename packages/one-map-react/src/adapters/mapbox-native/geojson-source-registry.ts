import type { ShapeSource } from "@rnmapbox/maps";
import type { ComponentRef } from "react";
import { createContext } from "react";

import { NativeSourceRegistry } from "../shared/native-source-registry.js";

type ShapeRef = ComponentRef<typeof ShapeSource>;
export type GeoJsonSourceRegistry = NativeSourceRegistry<ShapeRef, ShapeRef>;

/** Creates the source registry for one RNMapbox map. */
export const createGeoJsonSourceRegistry = (): GeoJsonSourceRegistry =>
  new NativeSourceRegistry((ref) => ref ?? undefined);

/** Sources rendered outside a map have no registration. */
export const GeoJsonSourceContext = createContext<GeoJsonSourceRegistry | null>(
  null
);
