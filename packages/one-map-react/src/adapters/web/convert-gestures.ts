import type { GestureSelection } from "../../contracts/map-types.js";

/**
 * Maps portable gestures onto react-map-gl handler props.
 *
 * Pinch zoom and rotation are `touchZoomRotate`. When zoom stays enabled and
 * `touchRotate` is false, the result keeps that handler on so the adapter can
 * disable rotation without disabling zoom.
 *
 * @param selection - Gesture flags. Omitted flags are left off the result.
 * @returns Props whose values were set, plus `touchZoomRotate` when the pinch
 * handler has to change.
 */
export const toWebGestureProps = (selection: GestureSelection) =>
  defined({
    interactive: selection.interactive,
    dragPan: selection.dragPan,
    scrollZoom: selection.scrollZoom,
    doubleClickZoom: selection.doubleClickZoom,
    dragRotate: selection.dragRotate,
    boxZoom: selection.boxZoom,
    keyboard: selection.keyboard,
    cooperativeGestures: selection.cooperativeGestures,
    clickTolerance: selection.clickTolerance,
    hash: selection.hash,
    touchPitch: selection.touchPitch,
    touchZoomRotate: webTouchZoomRotate(
      selection.touchZoom,
      selection.touchRotate
    ),
  });

/**
 * Chooses the web pinch handler value.
 *
 * @param touchZoom - Pinch zoom flag.
 * @param touchRotate - Rotation flag on that same handler.
 * @returns `false` when zoom is off, `true` when the handler must stay on,
 * and `undefined` when both flags were omitted.
 */
export const webTouchZoomRotate = (
  touchZoom: boolean | undefined,
  touchRotate: boolean | undefined
): boolean | undefined => {
  if (touchZoom === false) {
    return false;
  }

  if (touchRotate === false || touchZoom === true) {
    return true;
  }

  return undefined;
};

const defined = <Value>(
  values: Record<string, Value | undefined>
): Record<string, Value> =>
  Object.fromEntries(
    Object.entries(values).filter((entry) => entry[1] !== undefined)
  ) as Record<string, Value>;
