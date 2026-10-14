import type { Adapter } from "../../contracts/adapter.js";
import { MaplibreNativeImages } from "./images.js";
import { MaplibreNativeLayer } from "./layers.js";
import { MaplibreNativeMap } from "./map.js";
import { maplibreNativeServices } from "./services.js";
import { MaplibreNativeSource } from "./sources.js";
import { maplibreNativeUI } from "./ui.js";

/** Selects maplibre-native and translates MapLibre React Native components. */
export const adapter: Adapter & { readonly backend: "maplibre-native" } = {
  backend: "maplibre-native",
  services: maplibreNativeServices,
  Map: MaplibreNativeMap,
  Source: MaplibreNativeSource,
  Layer: MaplibreNativeLayer,
  ...maplibreNativeUI,
  Images: MaplibreNativeImages,
};
