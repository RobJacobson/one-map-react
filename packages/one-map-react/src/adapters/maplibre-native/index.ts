import type { Adapter } from "../../contracts/adapter.js";
import { MaplibreNativeImages } from "./images.js";
import { MaplibreNativeLayer } from "./layers.js";
import { MaplibreNativeMap } from "./map.js";
import { MaplibreNativeSource } from "./sources.js";
import { maplibreNativeUI } from "./ui.js";

/** Selects maplibre-native and translates MapLibre React Native components. */
export const adapter: Adapter & { readonly backend: "maplibre-native" } = {
  backend: "maplibre-native",
  // The concrete map only writes to the forwarded ref, so a common ref also accepts its handle.
  Map: MaplibreNativeMap as Adapter["Map"],
  Source: MaplibreNativeSource,
  Layer: MaplibreNativeLayer,
  ...maplibreNativeUI,
  Images: MaplibreNativeImages,
};

export { MaplibreNativeMap } from "./map.js";
export { MaplibreNativeLayer, type NativeLayerProps } from "./layers.js";
