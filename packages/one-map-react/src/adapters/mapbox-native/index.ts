import type { Adapter } from "../../contracts/adapter.js";
import { MapboxNativeImages } from "./images.js";
import { MapboxNativeLayer } from "./layers.js";
import { MapboxNativeMap } from "./map.js";
import { MapboxNativeSource } from "./sources.js";
import { mapboxNativeUI } from "./ui.js";

/** Selects mapbox-native and translates RNMapbox components. */
export const adapter: Adapter & { readonly backend: "mapbox-native" } = {
  backend: "mapbox-native",
  // The concrete map only writes to the forwarded ref, so a common ref also accepts its handle.
  Map: MapboxNativeMap as Adapter["Map"],
  Source: MapboxNativeSource,
  Layer: MapboxNativeLayer,
  ...mapboxNativeUI,
  Images: MapboxNativeImages,
};

export { CameraGestureObserver } from "@rnmapbox/maps";

export type { GestureSettings } from "./gesture-settings.js";
export { MapboxGestureSettings } from "./gesture-settings.js";
export { MapboxNativeMap } from "./map.js";
