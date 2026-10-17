import type { GestureSelection } from "../../contracts/map-types.js";

/**
 * Maps portable gestures onto RNMapbox map props.
 *
 * @remarks
 * `interactive: false` forces every flag off. `dragPan` becomes
 * `scrollEnabled`. Double-tap sets both the zoom-in and two-finger zoom-out
 * entries so the requested double-tap intent is explicit.
 *
 * @param selection - Portable gesture flags.
 * @returns Scroll, zoom, rotate, pitch, and double-tap settings that were set.
 */
export const toRnmapboxGestures = (selection: GestureSelection) => {
  const scrollEnabled = forcedOff(selection.interactive, selection.dragPan);
  const zoomEnabled = forcedOff(selection.interactive, selection.touchZoom);
  const rotateEnabled = forcedOff(selection.interactive, selection.touchRotate);
  const pitchEnabled = forcedOff(selection.interactive, selection.touchPitch);
  const doubleTap = forcedOff(selection.interactive, selection.doubleTapZoom);

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

const forcedOff = (
  interactive: boolean | undefined,
  flag: boolean | undefined
): boolean | undefined => (interactive === false ? false : flag);
