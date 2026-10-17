import type { GestureSelection } from "../../contracts/map-types.js";

/**
 * Maps portable gestures onto react-map-gl handler props.
 *
 * @remarks
 * Pinch zoom and rotation are `touchZoomRotate`. When zoom stays enabled and
 * `touchRotate` is false, the result keeps that handler on so the adapter can
 * disable rotation without disabling zoom.
 *
 * `interactive: false` disables every mutable handler. Clearing that override
 * restores explicit flags or the wrapper's defaults for omitted flags.
 *
 * @param selection - Gesture flags. Omitted flags use wrapper defaults.
 * @returns Props whose values were set, plus `touchZoomRotate` when the pinch
 * handler has to change.
 */
export const toWebGestureProps = (selection: GestureSelection) =>
  defined({
    interactive: selection.interactive,
    dragPan: forcedOff(selection.interactive, selection.dragPan),
    scrollZoom: forcedOff(selection.interactive, selection.scrollZoom),
    doubleClickZoom: forcedOff(
      selection.interactive,
      webDoubleZoom(selection.doubleTapZoom, selection.doubleClickZoom)
    ),
    dragRotate: forcedOff(selection.interactive, selection.dragRotate),
    boxZoom: forcedOff(selection.interactive, selection.boxZoom),
    keyboard: forcedOff(selection.interactive, selection.keyboard),
    cooperativeGestures: selection.cooperativeGestures,
    clickTolerance: selection.clickTolerance,
    hash: selection.hash,
    touchPitch: forcedOff(selection.interactive, selection.touchPitch),
    touchZoomRotate: forcedOff(
      selection.interactive,
      webTouchZoomRotate(selection.touchZoom, selection.touchRotate)
    ),
  });

const forcedOff = (
  interactive: boolean | undefined,
  flag: boolean | undefined
): boolean | undefined => (interactive === false ? false : flag);

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

const webDoubleZoom = (
  tap: boolean | undefined,
  click: boolean | undefined
): boolean | undefined => {
  if (tap !== undefined && click !== undefined && tap !== click) {
    throw new Error(
      "doubleTapZoom and doubleClickZoom must agree on web maps."
    );
  }
  return tap ?? click;
};
