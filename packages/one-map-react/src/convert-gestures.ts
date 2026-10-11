/**
 * Portable gesture flags and the web-only options that share their props.
 */
export interface GestureSelection {
  /** Turns interaction off when `false`. */
  readonly interactive?: boolean;
  /** One-finger pan. */
  readonly dragPan?: boolean;
  /** Pinch zoom. */
  readonly touchZoom?: boolean;
  /** Rotation on the pinch handler. */
  readonly touchRotate?: boolean;
  /** Pitch gesture. */
  readonly touchPitch?: boolean;
  /** Double-tap zoom. */
  readonly doubleTapZoom?: boolean;
  /** Wheel zoom. Web only. */
  readonly scrollZoom?: boolean;
  /** Double-click zoom. Web only. */
  readonly doubleClickZoom?: boolean;
  /** Right-drag rotation. Web only. */
  readonly dragRotate?: boolean;
  /** Shift-drag box zoom. Web only. */
  readonly boxZoom?: boolean;
  /** Keyboard camera controls. Web only. */
  readonly keyboard?: boolean;
  /** Modifier required before wheel zoom. Web only. */
  readonly cooperativeGestures?: boolean;
  /** Click distance in pixels. Web only. */
  readonly clickTolerance?: number;
  /** Page URL hash camera. Web only. */
  readonly hash?: boolean | string;
}

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

/**
 * Maps portable gestures onto RNMapbox map props.
 *
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

/**
 * Maps portable gestures onto MapLibre Native map props.
 *
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

const defined = <Value>(
  values: Record<string, Value | undefined>
): Record<string, Value> =>
  Object.fromEntries(
    Object.entries(values).filter((entry) => entry[1] !== undefined)
  ) as Record<string, Value>;
