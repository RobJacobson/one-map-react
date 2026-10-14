import type { Adapter } from "../../contracts/adapter.js";
import { MapboxNativeImages } from "./images.js";
import { MapboxNativeLayer } from "./layers.js";
import { MapboxNativeMap } from "./map.js";
import { mapboxNativeServices } from "./services.js";
import { MapboxNativeSource } from "./sources.js";
import { mapboxNativeUI } from "./ui.js";

/** Selects mapbox-native and translates RNMapbox components. */
export const adapter: Adapter & { readonly backend: "mapbox-native" } = {
  backend: "mapbox-native",
  services: mapboxNativeServices,
  Map: MapboxNativeMap,
  Source: MapboxNativeSource,
  Layer: MapboxNativeLayer,
  ...mapboxNativeUI,
  Images: MapboxNativeImages,
};

export { CameraGestureObserver } from "@rnmapbox/maps";

export type { GestureSettings } from "./gesture-settings.js";
export { MapboxGestureSettings } from "./gesture-settings.js";
