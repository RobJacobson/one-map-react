import type { GestureSelection } from "../../contracts/map-types.js";

/**
 * Maps portable gestures onto MapLibre Native map props.
 *
 * @remarks
 * `doubleTapZoom` and `doubleTapHoldZoom` are passed together, including
 * beside `touchZoom: false`. iOS enables that recognizer on its own. Android
 * SDK 13.6.1 still requires zoom gestures, so a double tap does not zoom
 * there while pinch zoom is off.
 *
 * @param selection - Portable gesture flags.
 * @returns Drag, pinch, rotate, pitch, and double-tap props that were set.
 */
export const toMaplibreGestures = (selection: GestureSelection) => {
  const dragPan = forcedOff(selection.interactive, selection.dragPan);
  const touchZoom = forcedOff(selection.interactive, selection.touchZoom);
  const touchRotate = forcedOff(selection.interactive, selection.touchRotate);
  const touchPitch = forcedOff(selection.interactive, selection.touchPitch);
  const doubleTapZoom = forcedOff(
    selection.interactive,
    selection.doubleTapZoom
  );

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

const forcedOff = (
  interactive: boolean | undefined,
  flag: boolean | undefined
): boolean | undefined => (interactive === false ? false : flag);
