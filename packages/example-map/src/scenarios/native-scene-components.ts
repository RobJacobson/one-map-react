import { Layer, Map as NativeMap, Marker, Source } from "one-map-react/legacy";
import { Images, UserLocation } from "one-map-react/native-extensions";

import { captureRendering } from "./capture-rendering.native.js";
import type { NativeSceneComponents } from "./scene-components.js";

/** Native-only imports for the shared acceptance scenes. */
export const nativeSceneComponents: NativeSceneComponents = {
  platform: "native",
  Map: NativeMap,
  Marker,
  Source,
  Layer,
  Images,
  UserLocation,
  captureRendering,
};
