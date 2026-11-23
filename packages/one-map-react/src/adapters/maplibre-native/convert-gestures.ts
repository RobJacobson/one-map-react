import type { MapProps as MaplibreMapProps } from "@maplibre/maplibre-react-native";

import {
  type NativeGestureSelection,
  normalizeNativeGestures,
} from "../native-gestures.js";

/**
 * Maps portable gestures onto MapLibre React Native map props.
 *
 * `doubleTapZoom` and `doubleTapHoldZoom` are passed together, including
 * beside `touchZoom: false`. iOS enables that recognizer on its own. Android
 * SDK 13.6.1 still requires zoom gestures, so a double tap does not zoom
 * there while pinch zoom is off.
 *
 * @param selection - Portable gesture flags.
 * @returns Drag, pinch, rotate, pitch, and double-tap props that were set.
 */
export const toMaplibreGestures = (
  selection: NativeGestureSelection
): Pick<
  MaplibreMapProps,
  | "dragPan"
  | "touchZoom"
  | "touchRotate"
  | "touchPitch"
  | "doubleTapZoom"
  | "doubleTapHoldZoom"
> => {
  const { dragPan, touchZoom, touchRotate, touchPitch, doubleTapZoom } =
    normalizeNativeGestures(selection);

  return {
    ...(dragPan === undefined ? {} : { dragPan }),
    ...(touchZoom === undefined ? {} : { touchZoom }),
    ...(touchRotate === undefined ? {} : { touchRotate }),
    ...(touchPitch === undefined ? {} : { touchPitch }),
    ...(doubleTapZoom === undefined
      ? {}
      : { doubleTapZoom, doubleTapHoldZoom: doubleTapZoom }),
  };
};
