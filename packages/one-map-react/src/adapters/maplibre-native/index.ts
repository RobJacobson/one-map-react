import type { Adapter } from "../../contracts/adapter.js";
import { MaplibreNativeImages } from "./images.js";
import { MaplibreNativeLayer } from "./layers.js";
import { MaplibreNativeMap } from "./map.js";
import { MaplibreNativeSource } from "./sources.js";

/** Selects maplibre-native and translates MapLibre React Native components. */
export const adapter: Adapter & { readonly backend: "maplibre-native" } = {
  backend: "maplibre-native",
  Map: MaplibreNativeMap,
  Source: MaplibreNativeSource,
  Layer: MaplibreNativeLayer,
  Images: MaplibreNativeImages,
};
