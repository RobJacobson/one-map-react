import { Images, UserLocation } from "one-map-react/native-extensions";

import { captureRendering } from "./capture-rendering.native.js";
import type {
  NativeBackend,
  NativeSceneComponents,
} from "./scene-components.js";

/**
 * Adds native extensions to the bindings supplied by the selected entry.
 *
 * @param backend - Renderer identity for command transport and observations.
 * @param bindings - Components and lookup from one selected native entry.
 * @returns The native components used by the shared acceptance screens.
 */
export const createNativeSceneComponents = (
  backend: NativeBackend,
  {
    Map: NativeMap,
    Marker,
    Source,
    Layer,
    MapProvider,
    useMap,
  }: Pick<
    NativeSceneComponents,
    "Map" | "Marker" | "Source" | "Layer" | "MapProvider" | "useMap"
  >
): NativeSceneComponents => ({
  platform: "native",
  backend,
  Map: NativeMap,
  Marker,
  Source,
  Layer,
  MapProvider,
  useMap,
  Images,
  UserLocation,
  captureRendering,
});
