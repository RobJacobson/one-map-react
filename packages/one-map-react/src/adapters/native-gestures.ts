import type { GestureSelection } from "../contracts/map-types.js";
import type { NativeMapInputs } from "../contracts/native-types.js";

/** Portable gesture selection with the native combined zoom and rotation flag. */
export type NativeGestureSelection = GestureSelection &
  Pick<NativeMapInputs, "touchZoomRotate">;

type NativeGestureFlags = Pick<
  GestureSelection,
  "dragPan" | "touchZoom" | "touchRotate" | "touchPitch" | "doubleTapZoom"
>;

/**
 * Applies the native interaction lock and the combined gesture fallback.
 *
 * @param selection - Flags supplied to the native map.
 * @returns Portable flags, with unspecified gestures left undefined.
 */
export const normalizeNativeGestures = ({
  interactive,
  touchZoomRotate,
  dragPan,
  touchZoom = touchZoomRotate,
  touchRotate = touchZoomRotate,
  touchPitch,
  doubleTapZoom,
}: NativeGestureSelection): NativeGestureFlags => {
  if (interactive === false) {
    return {
      dragPan: false,
      touchZoom: false,
      touchRotate: false,
      touchPitch: false,
      doubleTapZoom: false,
    };
  }

  return { dragPan, touchZoom, touchRotate, touchPitch, doubleTapZoom };
};
