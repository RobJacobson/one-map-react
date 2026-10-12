import type { Adapter } from "../../contracts/adapter.js";
import { MapboxNativeImages } from "./images.js";
import { MapboxNativeLayer } from "./layers.js";
import { MapboxNativeMap } from "./map.js";
import { MapboxNativeSource } from "./sources.js";

/** Selects mapbox-native and translates RNMapbox components. */
export const adapter: Adapter & { readonly backend: "mapbox-native" } = {
  backend: "mapbox-native",
  Map: MapboxNativeMap,
  Source: MapboxNativeSource,
  Layer: MapboxNativeLayer,
  Images: MapboxNativeImages,
};

export { CameraGestureObserver } from "@rnmapbox/maps";

export type { GestureSettings } from "./gesture-settings.js";
export { MapboxGestureSettings } from "./gesture-settings.js";
