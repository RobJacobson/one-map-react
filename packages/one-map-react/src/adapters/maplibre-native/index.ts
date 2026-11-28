import type { NativeComponents } from "../../facade/map-context.js";
import { MaplibreNativeImages } from "./images.js";
import { MaplibreNativeLayer } from "./MaplibreNativeLayer.js";
import { MaplibreNativeSource } from "./sources.js";
import { maplibreNativeUI } from "./ui.js";

/** Selects maplibre-native and translates MapLibre React Native components. */
export const nativeComponents = {
  backend: "maplibre-native",
  Source: MaplibreNativeSource,
  Layer: MaplibreNativeLayer,
  ...maplibreNativeUI,
  Images: MaplibreNativeImages,
} satisfies NativeComponents;

export { MaplibreNativeMap } from "./map.js";
export {
  MaplibreNativeLayer,
  type NativeLayerProps,
} from "./MaplibreNativeLayer.js";
export { maplibreLightForNative } from "./style-roots.js";
export { useMaplibreMapStyle } from "./use-maplibre-map-style.js";
