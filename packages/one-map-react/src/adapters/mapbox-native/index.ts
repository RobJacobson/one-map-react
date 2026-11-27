import type { NativeComponents } from "../../facade/map-context.js";
import { MapboxNativeImages } from "./images.js";
import { MapboxNativeLayer } from "./layers.js";
import { MapboxNativeSource } from "./sources.js";
import { mapboxNativeUI } from "./ui.js";

/** Selects mapbox-native and translates RNMapbox components. */
export const nativeComponents = {
  backend: "mapbox-native",
  Source: MapboxNativeSource,
  Layer: MapboxNativeLayer,
  ...mapboxNativeUI,
  Images: MapboxNativeImages,
} satisfies NativeComponents;

export { CameraGestureObserver } from "@rnmapbox/maps";

export type { NativeAdvancedMapRef } from "./map-ref.js";
export type { GestureSettings } from "./MapboxGestureSettings.js";
export { MapboxGestureSettings } from "./MapboxGestureSettings.js";
export { MapboxNativeLayer } from "./layers.js";
export { MapboxNativeMap } from "./MapboxNativeMap.js";
