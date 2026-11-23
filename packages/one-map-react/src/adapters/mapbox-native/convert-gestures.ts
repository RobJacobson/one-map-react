import {
  type NativeGestureSelection,
  normalizeNativeGestures,
} from "../native-gestures.js";

/**
 * Maps portable gestures onto RNMapbox map props.
 *
 * `dragPan` becomes `scrollEnabled`. Double-tap sets both the zoom-in and
 * two-finger zoom-out entries so the requested double-tap intent is explicit.
 *
 * @param selection - Portable gesture flags.
 * @returns Scroll, zoom, rotate, pitch, and double-tap settings that were set.
 */
export const toRnmapboxGestures = (
  selection: NativeGestureSelection
): {
  scrollEnabled?: boolean;
  zoomEnabled?: boolean;
  rotateEnabled?: boolean;
  pitchEnabled?: boolean;
  gestureSettings?: {
    doubleTapToZoomInEnabled: boolean;
    doubleTouchToZoomOutEnabled: boolean;
  };
} => {
  const {
    dragPan: scrollEnabled,
    touchZoom: zoomEnabled,
    touchRotate: rotateEnabled,
    touchPitch: pitchEnabled,
    doubleTapZoom: doubleTap,
  } = normalizeNativeGestures(selection);

  return {
    ...(scrollEnabled === undefined ? {} : { scrollEnabled }),
    ...(zoomEnabled === undefined ? {} : { zoomEnabled }),
    ...(rotateEnabled === undefined ? {} : { rotateEnabled }),
    ...(pitchEnabled === undefined ? {} : { pitchEnabled }),
    ...(doubleTap === undefined
      ? {}
      : {
          gestureSettings: {
            doubleTapToZoomInEnabled: doubleTap,
            doubleTouchToZoomOutEnabled: doubleTap,
          },
        }),
  };
};
